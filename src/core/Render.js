export class Renderer {
  constructor(gl, canvas) {
    this.gl     = gl;
    this.canvas = canvas;

    this._init();
    this._bindResize();
  }

  _init() {
    const gl = this.gl;
    this.resize();
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0.02, 0.02, 0.05, 1.0);
  }

  beginFrame(clearColor = null) {
    const gl = this.gl;
    if (clearColor) {
      gl.clearColor(clearColor[0], clearColor[1], clearColor[2], 1.0);
    }
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  }

  endFrame() {}

  resize() {
    const gl     = this.gl;
    const canvas = this.canvas;
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    gl.viewport(0, 0, canvas.width, canvas.height);
  }

  _bindResize() {
    window.addEventListener('resize', () => this.resize());
  }

  /**
   * Restore ALL WebGL state that Three.js clobbers during its render pass.
   * Must be called AFTER threeRenderer.render(), not before.
   */
  resetState() {
    const gl     = this.gl;
    const canvas = this.canvas;

    // FIX: restore viewport — Three.js sets its own during render()
    gl.viewport(0, 0, canvas.width, canvas.height);

    // FIX: restore depth state Three.js may have changed
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.depthMask(true);

    // FIX: restore face culling
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);

    // FIX: restore blend state — Three.js leaves its own blend mode active
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    gl.colorMask(true, true, true, true);

    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
  }

  hardReset() {
    gl.finish();
    this.resetState();
  }
}
