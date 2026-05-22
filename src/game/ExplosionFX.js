const COUNT = 80;

const VERT = `
attribute float aSeed;
uniform mat4  uView;
uniform mat4  uProjection;
uniform vec3  uOrigin;
uniform float uTime;
uniform float uAlive;

float hash(float n) { return fract(sin(n) * 43758.5453); }

void main() {
  if (uAlive < 0.5) {
    gl_Position  = vec4(0.0, -9999.0, 0.0, 1.0);
    gl_PointSize = 0.0;
    return;
  }

  float theta = hash(aSeed) * 6.2832;
  float phi   = hash(aSeed+1.0) * 3.1416;
  float speed = 2.0 + hash(aSeed+2.0) * 6.0; // smaller burst

  vec3 dir = vec3(sin(phi)*cos(theta), cos(phi), sin(phi)*sin(theta));
  vec3 pos = uOrigin + dir * speed * uTime;

  gl_Position  = uProjection * uView * vec4(pos, 1.0);

  float life = 1.0 - uTime / 1.0;
  gl_PointSize = max(0.0, life * (2.0 + hash(aSeed+3.0) * 4.0));
}
`;

const FRAG = `
precision mediump float;
uniform float uTime;

void main() {
  float life = 1.0 - uTime;

  vec3 cyan = vec3(0.0, 1.0, 0.9);
  vec3 white = vec3(1.0);

  vec3 col = mix(cyan, white, life);

  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);

  if (d > 0.5) discard;

  gl_FragColor = vec4(col, life);
}
`;

export class ExplosionFX {
  constructor(gl) {
    this.gl      = gl;
    this._prog   = _build(gl, VERT, FRAG);
    this._vbo    = _seeds(gl, COUNT);

    this._active = false;
    this._time   = 2;
    this._origin = [0,0,0];
  }

  trigger(pos) {
    this._origin = [...pos];
    this._time = 0;
    this._active = true;
  }

  update(dt) {
    if (!this._active) return;
    this._time += dt;
    if (this._time >= 1.0) this._active = false;
  }

  draw(camera) {
    const gl = this.gl;
    if (!this._active) return;

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    gl.depthMask(false);
    gl.useProgram(this._prog);

    const aSeed = gl.getAttribLocation(this._prog, 'aSeed');

    gl.bindBuffer(gl.ARRAY_BUFFER, this._vbo);
    gl.enableVertexAttribArray(aSeed);
    gl.vertexAttribPointer(aSeed, 1, gl.FLOAT, false, 0, 0);

    gl.uniformMatrix4fv(gl.getUniformLocation(this._prog,'uView'), false, camera.getViewMatrix());
    gl.uniformMatrix4fv(gl.getUniformLocation(this._prog,'uProjection'), false, camera.getProjectionMatrix());
    gl.uniform3fv(gl.getUniformLocation(this._prog,'uOrigin'), this._origin);
    gl.uniform1f(gl.getUniformLocation(this._prog,'uTime'), this._time);
    gl.uniform1f(gl.getUniformLocation(this._prog,'uAlive'), 1.0);

    gl.drawArrays(gl.POINTS, 0, COUNT);

    gl.depthMask(true);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  }
}

function _build(gl,v,f){
  const vs=_sh(gl,gl.VERTEX_SHADER,v);
  const fs=_sh(gl,gl.FRAGMENT_SHADER,f);
  const p=gl.createProgram();
  gl.attachShader(p,vs);
  gl.attachShader(p,fs);
  gl.linkProgram(p);
  return p;
}

function _sh(gl,t,s){
  const sh=gl.createShader(t);
  gl.shaderSource(sh,s);
  gl.compileShader(sh);
  return sh;
}

function _seeds(gl,n){
  const d=new Float32Array(n);
  for(let i=0;i<n;i++) d[i]=Math.random();
  const b=gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER,b);
  gl.bufferData(gl.ARRAY_BUFFER,d,gl.STATIC_DRAW);
  return b;
}