// src/weather/RainParticles.js

const MAX_PARTICLES = 4000;

// Vertex shader for rain: each particle is a seed → GPU computes position
const RAIN_VERT = `
attribute float aSeed;     // unique random value per particle [0,1]

uniform mat4  uView;
uniform mat4  uProjection;
uniform float uTime;       // total elapsed seconds
uniform vec3  uDronePos;   // keep rain centred on the drone
uniform float uWindX;
uniform float uWindZ;
uniform float uSpeed;      // fall speed multiplier

// Simple hash: maps a float to a pseudo-random float
float hash(float n) { return fract(sin(n) * 43758.5453); }

void main() {
  // Spread particles in a 120×120 column around the drone
  float spread = 60.0;
  float height = 60.0;  // vertical band

  float px = (hash(aSeed)          - 0.5) * spread * 2.0;
  float pz = (hash(aSeed + 1.7)    - 0.5) * spread * 2.0;

  // Phase: each particle starts at a different height,
  // falls at slightly randomised speed, then wraps back to top
  float speed    = uSpeed * (0.8 + hash(aSeed + 3.1) * 0.4);
  float phase    = hash(aSeed + 5.3) * height;
  float y        = height - mod(phase + uTime * speed, height);

  // Wind drift accumulates with fall distance
  float fallFrac = (height - y) / height;
  px += uWindX * fallFrac * 2.0;
  pz += uWindZ * fallFrac * 2.0;

  vec3 worldPos = uDronePos + vec3(px, y - 30.0, pz);
  gl_Position   = uProjection * uView * vec4(worldPos, 1.0);

  // Larger point = thicker rain during storm
  gl_PointSize = 1.5;
}
`;

const RAIN_FRAG = `
precision mediump float;
uniform float uOpacity;
void main() {
  // Elongate into a streak using point coord Y
  float streak = 1.0 - abs(gl_PointCoord.y - 0.5) * 2.0;
  gl_FragColor = vec4(0.7, 0.85, 1.0, streak * uOpacity);
}
`;

export class RainParticles {
  constructor(gl) {
    this.gl      = gl;
    this._prog   = this._buildProgram();
    this._vbo    = this._buildSeeds();
    this._count  = 0;   // actual particles to draw (driven by WeatherSystem)
    this._time   = 0;
  }

  // ── Build ─────────────────────────────────────────────────────────

  _buildProgram() {
    const gl   = this.gl;
    const vert = this._compile(gl.VERTEX_SHADER,   RAIN_VERT);
    const frag = this._compile(gl.FRAGMENT_SHADER, RAIN_FRAG);
    const prog = gl.createProgram();
    gl.attachShader(prog, vert);
    gl.attachShader(prog, frag);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS))
      console.error('Rain shader link error:', gl.getProgramInfoLog(prog));
    return prog;
  }

  _compile(type, src) {
    const gl = this.gl;
    const s  = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
      console.error('Rain shader compile error:', gl.getShaderInfoLog(s));
    return s;
  }

  _buildSeeds() {
    const gl    = this.gl;
    // One float per particle — the unique seed
    const seeds = new Float32Array(MAX_PARTICLES);
    for (let i = 0; i < MAX_PARTICLES; i++) seeds[i] = Math.random();

    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, seeds, gl.STATIC_DRAW);
    return vbo;
  }

  // ── Per-frame ─────────────────────────────────────────────────────

  update(dt, particleCount) {
    this._time  += dt;
    // Smoothly ramp particle count toward target
    const target = Math.min(particleCount, MAX_PARTICLES);
    this._count += (target - this._count) * Math.min(dt * 2, 1);
  }

  draw(camera, dronePos, wind, fallSpeed = 14) {
    const gl   = this.gl;
    const count = Math.floor(this._count);
    if (count < 1) return;

    // Rain needs additive-ish blending — alpha blend is fine
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);   // additive for bright rain
    gl.depthMask(false);                  // don't write to depth buffer

    gl.useProgram(this._prog);

    gl.bindBuffer(gl.ARRAY_BUFFER, this._vbo);
    const aSeed = gl.getAttribLocation(this._prog, 'aSeed');
    gl.enableVertexAttribArray(aSeed);
    gl.vertexAttribPointer(aSeed, 1, gl.FLOAT, false, 0, 0);

    gl.uniformMatrix4fv(
      gl.getUniformLocation(this._prog, 'uView'),       false, camera.getViewMatrix());
    gl.uniformMatrix4fv(
      gl.getUniformLocation(this._prog, 'uProjection'), false, camera.getProjectionMatrix());
    gl.uniform1f(gl.getUniformLocation(this._prog, 'uTime'),    this._time);
    gl.uniform3fv(gl.getUniformLocation(this._prog, 'uDronePos'), dronePos);
    gl.uniform1f(gl.getUniformLocation(this._prog, 'uWindX'),   wind[0] * 0.08);
    gl.uniform1f(gl.getUniformLocation(this._prog, 'uWindZ'),   wind[2] * 0.08);
    gl.uniform1f(gl.getUniformLocation(this._prog, 'uSpeed'),   fallSpeed);
    // Opacity scales with count (light drizzle = faint streaks)
    const opacity = 0.15 + (count / MAX_PARTICLES) * 0.55;
    gl.uniform1f(gl.getUniformLocation(this._prog, 'uOpacity'), opacity);

    gl.drawArrays(gl.POINTS, 0, count);

    // Restore state
    gl.depthMask(true);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  }
}