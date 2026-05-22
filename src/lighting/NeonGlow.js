// ── Embedded GLSL shaders for post-processing ─────────────────────────────
const QUAD_VERT = `
attribute vec2 aPosition;
varying   vec2 vUV;
void main() {
  vUV         = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

const BRIGHT_FRAG = `
precision mediump float;
varying   vec2      vUV;
uniform   sampler2D uTex;
uniform   float     uThreshold;
void main() {
  vec3  c   = texture2D(uTex, vUV).rgb;
  float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
  gl_FragColor = vec4(lum > uThreshold ? c : vec3(0.0), 1.0);
}`;

const BLUR_FRAG = `
precision mediump float;
varying   vec2      vUV;
uniform   sampler2D uTex;
uniform   vec2      uDir;
void main() {
  vec3 r = vec3(0.0);
  r += texture2D(uTex, vUV + uDir * -4.0).rgb * 0.0162;
  r += texture2D(uTex, vUV + uDir * -3.0).rgb * 0.0540;
  r += texture2D(uTex, vUV + uDir * -2.0).rgb * 0.1216;
  r += texture2D(uTex, vUV + uDir * -1.0).rgb * 0.1945;
  r += texture2D(uTex, vUV             ).rgb * 0.2270;
  r += texture2D(uTex, vUV + uDir *  1.0).rgb * 0.1945;
  r += texture2D(uTex, vUV + uDir *  2.0).rgb * 0.1216;
  r += texture2D(uTex, vUV + uDir *  3.0).rgb * 0.0540;
  r += texture2D(uTex, vUV + uDir *  4.0).rgb * 0.0162;
  gl_FragColor = vec4(r, 1.0);
}`;

const COMP_FRAG = `
precision mediump float;
varying   vec2      vUV;
uniform   sampler2D uTex;
uniform   sampler2D uBloomTex;
uniform   float     uBloomStrength;
void main() {
  vec3 scene = texture2D(uTex,      vUV).rgb;
  vec3 bloom = texture2D(uBloomTex, vUV).rgb;
  vec3 col   = scene + bloom * uBloomStrength;

  // Vignette: darkens screen corners for cinematic look
  vec2  uv2  = vUV * (1.0 - vUV.yx);
  float vign = pow(uv2.x * uv2.y * 14.0, 0.22);
  col *= vign;

  gl_FragColor = vec4(col, 1.0);
}`;

// ── NeonGlow class ────────────────────────────────────────────────────────────

export class NeonGlow {
  constructor(gl, canvas) {
    this.gl     = gl;
    this.width  = canvas.width;
    this.height = canvas.height;

    window.addEventListener('resize', () => {
      this.width  = canvas.width;
      this.height = canvas.height;
      this.sceneFBO = this._makeFBO();
      this.bloomFBO = this._makeFBO();
    });
  }

  /** Must be called once before the first frame. */
  init() {
    const gl = this.gl;

    // Build post-process shader programs
    this.brightProg = this._link(QUAD_VERT, BRIGHT_FRAG);
    this.blurProg   = this._link(QUAD_VERT, BLUR_FRAG);
    this.compProg   = this._link(QUAD_VERT, COMP_FRAG);

    // Full-screen quad: two triangles covering NDC [-1, +1]
    const verts = new Float32Array([-1,-1, 1,-1, 1,1, -1,-1, 1,1, -1,1]);
    this.quadVBO = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadVBO);
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);

    // Two FBOs: one for the scene, one for the bloom mask
    this.sceneFBO = this._makeFBO();
    this.bloomFBO = this._makeFBO();
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /** Redirect scene draw calls into the scene FBO. */
  bindSceneFBO() {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.sceneFBO.fbo);
    gl.viewport(0, 0, this.width, this.height);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  }

  /** Run bloom passes and composite to the canvas. */
  renderBloom(strength = 1.4) {
    const gl = this.gl;
    const w  = this.width, h = this.height;

    // Pass 2: brightness extraction → bloomFBO
    this._quad(this.brightProg, this.sceneFBO.tex, null, this.bloomFBO.fbo, (p) => {
      gl.uniform1f(gl.getUniformLocation(p, 'uThreshold'), 0.72);
    });

    // Pass 3: separable Gaussian blur (3 iterations)
    for (let i = 0; i < 3; i++) {
      this._quad(this.blurProg, this.bloomFBO.tex, null, this.bloomFBO.fbo, (p) => {
        gl.uniform2f(gl.getUniformLocation(p, 'uDir'), 1/w, 0);
      });
      this._quad(this.blurProg, this.bloomFBO.tex, null, this.bloomFBO.fbo, (p) => {
        gl.uniform2f(gl.getUniformLocation(p, 'uDir'), 0, 1/h);
      });
    }

    // Final composite → canvas (null FBO = default framebuffer)
    this._quad(this.compProg, this.sceneFBO.tex, this.bloomFBO.tex, null, (p) => {
      gl.uniform1f(gl.getUniformLocation(p, 'uBloomStrength'), strength);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, this.bloomFBO.tex);
      gl.uniform1i(gl.getUniformLocation(p, 'uBloomTex'), 1);
      gl.activeTexture(gl.TEXTURE0);
    });
  }

  // ── Internals ─────────────────────────────────────────────────────────────

  _makeFBO() {
    const gl  = this.gl;
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);

    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.width, this.height,
      0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);

    // Depth buffer (only the scene FBO needs it, but harmless to add both)
    const depth = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, depth);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, this.width, this.height);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depth);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { fbo, tex };
  }

  _quad(prog, tex, tex2, targetFBO, setup) {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, targetFBO || null);
    gl.viewport(0, 0, this.width, this.height);
    gl.disable(gl.DEPTH_TEST);
    gl.useProgram(prog);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadVBO);
    const aPos = gl.getAttribLocation(prog, 'aPosition');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.uniform1i(gl.getUniformLocation(prog, 'uTex'), 0);

    if (setup) setup(prog);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.enable(gl.DEPTH_TEST);
  }

  _link(vertSrc, fragSrc) {
    const gl = this.gl;
    const v  = this._compile(gl.VERTEX_SHADER,   vertSrc);
    const f  = this._compile(gl.FRAGMENT_SHADER, fragSrc);
    const p  = gl.createProgram();
    gl.attachShader(p, v); gl.attachShader(p, f);
    gl.linkProgram(p);
    return p;
  }

  _compile(type, src) {
    const gl = this.gl;
    const s  = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
      console.error('Post shader error:', gl.getShaderInfoLog(s));
    return s;
  }
}