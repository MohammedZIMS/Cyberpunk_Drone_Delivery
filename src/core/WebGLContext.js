export function initWebGL(canvasId) {
  const canvas = document.getElementById(canvasId);

  // Match the canvas resolution to the CSS size
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;

  // Request a WebGL context.  We try the standard name first, then the
  // experimental prefix used by older browsers.
  const gl =
    canvas.getContext('webgl', { antialias: true, alpha: false }) ||
    canvas.getContext('experimental-webgl');

  if (!gl) {
    alert('WebGL is not supported in your browser.');
    return null;
  }

  // Default GL state

  // Enable the depth buffer so closer fragments overwrite farther ones
  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);

  // Enable alpha blending for particles and transparent surfaces
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  // Deep cyberpunk purple-black clear colour
  gl.clearColor(0.008, 0.0, 0.03, 1.0);

  // Set initial viewport
  gl.viewport(0, 0, canvas.width, canvas.height);

  // Resize handler
  window.addEventListener('resize', () => {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    gl.viewport(0, 0, canvas.width, canvas.height);
  });

  return { gl, canvas };
}