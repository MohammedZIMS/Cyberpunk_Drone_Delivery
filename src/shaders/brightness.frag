/**
 * brightness.frag
 * Pass 2 of the bloom pipeline – brightness extraction.
 *
 * Samples the scene texture and outputs only pixels whose luminance
 * exceeds uThreshold. Dark pixels are written as solid black so the
 * subsequent Gaussian blur only spreads light that was already bright.
 *
 * Uniforms:
 *   uTex        sampler2D   Full scene render (Pass 1 FBO colour attachment)
 *   uThreshold  float       Luminance threshold [0,1]. Typical: 0.75
 *
 * Varyings (from quad.vert):
 *   vUV         vec2        Screen-space UV [0,1]
 */

precision mediump float;

varying vec2      vUV;
uniform sampler2D uTex;
uniform float     uThreshold;

void main() {
  vec3 color = texture2D(uTex, vUV).rgb;

  /*
   * Perceptual luminance weights (BT.709).
   * Human vision is most sensitive to green, then red, then blue.
   */
  float luminance = dot(color, vec3(0.2126, 0.7152, 0.0722));

  /*
   * Keep the original colour only where it is bright enough.
   * step(threshold, lum) returns 1.0 when lum >= threshold, 0.0 otherwise.
   * This avoids a branch which can be slow on some GPU drivers.
   */
  gl_FragColor = vec4(color * step(uThreshold, luminance), 1.0);
}
