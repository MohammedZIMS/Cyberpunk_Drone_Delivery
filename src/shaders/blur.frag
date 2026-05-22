/**
 * blur.frag
 * Pass 3 of the bloom pipeline – separable Gaussian blur.
 *
 * Run twice per bloom iteration:
 *   1. Horizontal pass  →  uDir = vec2(1.0/width,  0.0)
 *   2. Vertical   pass  →  uDir = vec2(0.0,  1.0/height)
 *
 * Using a separable 9-tap Gaussian is mathematically equivalent to a
 * 2-D 9×9 kernel but only costs 9 texture fetches instead of 81.
 *
 * Uniforms:
 *   uTex   sampler2D   Brightness-extracted or partially-blurred texture
 *   uDir   vec2        One-pixel step in the blur direction (see above)
 *
 * Varyings (from quad.vert):
 *   vUV    vec2        Screen-space UV [0,1]
 */

precision mediump float;

varying vec2      vUV;
uniform sampler2D uTex;
uniform vec2      uDir;   /* e.g. vec2(1.0/800.0, 0.0) for horizontal */

void main() {
  /*
   * Gaussian weights for a σ≈2 kernel (9 taps).
   * Weights sum to 1.0 so average brightness is preserved.
   *
   * Tap offsets:  -4  -3  -2  -1   0  +1  +2  +3  +4
   */
  vec3 result = vec3(0.0);
  result += texture2D(uTex, vUV + uDir * -4.0).rgb * 0.0162;
  result += texture2D(uTex, vUV + uDir * -3.0).rgb * 0.0540;
  result += texture2D(uTex, vUV + uDir * -2.0).rgb * 0.1216;
  result += texture2D(uTex, vUV + uDir * -1.0).rgb * 0.1945;
  result += texture2D(uTex, vUV             ).rgb * 0.2270; /* centre */
  result += texture2D(uTex, vUV + uDir *  1.0).rgb * 0.1945;
  result += texture2D(uTex, vUV + uDir *  2.0).rgb * 0.1216;
  result += texture2D(uTex, vUV + uDir *  3.0).rgb * 0.0540;
  result += texture2D(uTex, vUV + uDir *  4.0).rgb * 0.0162;

  gl_FragColor = vec4(result, 1.0);
}
