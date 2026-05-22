/**
 * quad.vert
 * Shared vertex shader for all fullscreen post-processing passes.
 *
 * Every post-process pass (brightness extract, blur, composite) draws
 * a fullscreen triangle-pair. This shader converts the raw [-1,1] NDC
 * positions into UV coordinates [0,1] for texture sampling in the
 * corresponding fragment shader.
 *
 * Attribute layout (matches NeonGlow._buildSeeds VBO):
 *   aPosition  vec2   NDC position of the quad vertex
 */

attribute vec2 aPosition;

/* Interpolated UV coordinate passed to the fragment shader. */
varying vec2 vUV;

void main() {
  /*
   * Map NDC [-1,1] → UV [0,1].
   * NDC  -1  →  UV  0
   * NDC  +1  →  UV  1
   */
  vUV = aPosition * 0.5 + 0.5;

  /* No projection needed – the quad already lives in clip space. */
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
