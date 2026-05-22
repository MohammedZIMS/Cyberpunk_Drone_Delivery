// src/core/Render.js

export class Renderer {
  constructor(gl, canvas) {
    this.gl = gl;
    this.canvas = canvas;

    this._init();
    this._bindResize();
  }

  // ─────────────────────────────────────────────
  // INIT
  // ─────────────────────────────────────────────

  _init() {
    const gl = this.gl;

    this.resize();

    // Core GL state (safe defaults)
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);

    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    gl.clearColor(0.02, 0.02, 0.05, 1.0);
  }

  // ─────────────────────────────────────────────
  // FRAME CONTROL
  // ─────────────────────────────────────────────

  /**
   * Call at start of each frame
   */
  beginFrame(clearColor = null) {
    const gl = this.gl;

    if (clearColor) {
      gl.clearColor(
        clearColor[0],
        clearColor[1],
        clearColor[2],
        1.0
      );
    }

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  }

  /**
   * Call at end of frame (useful if you add post-processing later)
   */
  endFrame() {
    // Placeholder for future effects (bloom, FXAA, etc.)
  }

  // ─────────────────────────────────────────────
  // VIEWPORT + RESIZE
  // ─────────────────────────────────────────────

  resize() {
    const gl = this.gl;
    const canvas = this.canvas;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    gl.viewport(0, 0, canvas.width, canvas.height);
  }

  _bindResize() {
    window.addEventListener('resize', () => {
      this.resize();
    });
  }

  // ─────────────────────────────────────────────
  // STATE HELPERS
  // ─────────────────────────────────────────────

  /**
   * Reset GL state (important when mixing Three.js + WebGL)
   */
  resetState() {
    const gl = this.gl;

    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);

    gl.depthMask(true);
    gl.colorMask(true, true, true, true);

    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
  }

  /**
   * Optional: force a clean slate (hard reset per frame)
   */
  hardReset() {
    const gl = this.gl;

    gl.finish();
    this.resetState();
  }
}