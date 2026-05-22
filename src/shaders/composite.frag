/**
 * composite.frag
 * Final post-processing pass – combines the scene with bloom glow,
 * applies a cinematic vignette, and optional chromatic aberration.
 *
 * Pipeline position:
 *   Pass 1  →  scene FBO
 *   Pass 2  →  brightness extract
 *   Pass 3  →  Gaussian blur (× N iterations)  →  bloom FBO
 *   Pass 4  →  THIS SHADER  →  canvas (default framebuffer)
 *
 * Uniforms:
 *   uTex           sampler2D  (unit 0)  Scene render
 *   uBloomTex      sampler2D  (unit 1)  Blurred bright regions
 *   uBloomStrength float               Bloom blend multiplier. 1.4 = default.
 *
 * Varyings (from quad.vert):
 *   vUV            vec2               Screen-space UV [0,1]
 */

precision mediump float;

varying vec2      vUV;
uniform sampler2D uTex;           /* scene colour */
uniform sampler2D uBloomTex;      /* blurred bright regions */
uniform float     uBloomStrength; /* how much bloom to add */

/* ── Chromatic aberration strength (pixels of offset, in UV space) ── */
const float CA_AMOUNT = 0.0018;

void main() {
  /* ── 1. Chromatic aberration ──────────────────────────────────────
   *
   * Slightly offset the R and B channels outward from screen centre.
   * This mimics the lens distortion of a physical camera and adds to
   * the lo-fi cyberpunk aesthetic.
   *
   * dir: unit vector pointing from UV toward screen edge.
   */
  vec2  dir    = vUV - 0.5;            /* offset from centre */
  float dist   = length(dir);
  vec2  offset = normalize(dir) * dist * CA_AMOUNT;

  float r = texture2D(uTex, vUV + offset).r;
  float g = texture2D(uTex, vUV         ).g; /* green unchanged */
  float b = texture2D(uTex, vUV - offset).b;

  vec3 scene = vec3(r, g, b);

  /* ── 2. Additive bloom ────────────────────────────────────────────
   *
   * Bloom is pure energy – it only adds light, never subtracts.
   * Additive blending naturally handles HDR neon colours without
   * needing a tonemapping stage for the bloom texture itself.
   */
  vec3 bloom  = texture2D(uBloomTex, vUV).rgb;
  vec3 result = scene + bloom * uBloomStrength;

  /* ── 3. Vignette ─────────────────────────────────────────────────
   *
   * Darkens the corners to focus the eye on the centre of the screen.
   * Formula: uv2 = vUV * (1 - vUV) gives 0 at edges, 0.25 at centre.
   * pow() controls the falloff curve; 0.25 gives a soft wide vignette.
   */
  vec2  uv2  = vUV * (1.0 - vUV.yx);
  float vign = pow(uv2.x * uv2.y * 15.0, 0.25);
  result    *= vign;

  gl_FragColor = vec4(result, 1.0);
}
