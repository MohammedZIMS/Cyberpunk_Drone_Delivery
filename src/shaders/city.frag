/**
 * city.frag
 * Fragment shader for all scene geometry.
 *
 * Implements:
 *   • Blinn-Phong multi-light shading (up to MAX_LIGHTS point lights)
 *   • Inverse-square distance attenuation with a configurable radius
 *   • Emissive neon surfaces (uEmissive > 0)
 *   • Exponential distance fog (cyberpunk purple haze)
 *   • Reinhard tone mapping to prevent HDR blowout
 *   • Hit-flash (blend toward red on drone collision)
 *
 * Uniforms – lights (uploaded as flat arrays by LightingSystem.js):
 *   uNumLights       int              Number of active lights (≤ MAX_LIGHTS)
 *   uLightPos        vec3[MAX_LIGHTS] World-space light positions
 *   uLightColor      vec3[MAX_LIGHTS] Light RGB colour
 *   uLightIntensity  float[MAX_LIGHTS] Scalar brightness multiplier
 *   uLightRadius     float[MAX_LIGHTS] Falloff radius in world units
 *
 * Uniforms – material / fx:
 *   uCameraPos  vec3   World-space camera position (for specular)
 *   uEmissive   float  0.0 = normal; 1.0+ = self-illuminated neon surface
 *   uHitFlash   float  0.0 = normal; 1.0 = full red collision flash
 *
 * Uniforms – atmosphere:
 *   uFogDensity float  Exponential fog coefficient. ~0.002 = clear, ~0.02 = storm
 *   uFogColor   vec3   Fog RGB colour (deep purple night)
 *
 * Varyings (from city.vert):
 *   vNormal      vec3
 *   vFragPos     vec3
 *   vObjectColor vec3
 *   vDepth       float
 */

precision mediump float;

/* ── Constants ──────────────────────────────────────────────────────── */
#define MAX_LIGHTS 32

/* ── Varyings ───────────────────────────────────────────────────────── */
varying vec3  vNormal;
varying vec3  vFragPos;
varying vec3  vObjectColor;
varying float vDepth;

/* ── Light uniforms ─────────────────────────────────────────────────── */
uniform int   uNumLights;
uniform vec3  uLightPos      [MAX_LIGHTS];
uniform vec3  uLightColor    [MAX_LIGHTS];
uniform float uLightIntensity[MAX_LIGHTS];
uniform float uLightRadius   [MAX_LIGHTS];

/* ── Effect uniforms ────────────────────────────────────────────────── */
uniform vec3  uCameraPos;
uniform float uEmissive;
uniform float uHitFlash;

/* ── Atmosphere uniforms ─────────────────────────────────────────────── */
uniform float uFogDensity;
uniform vec3  uFogColor;

void main() {

  /* ── Surface vectors ─────────────────────────────────────────────── */
  vec3 norm    = normalize(vNormal);
  vec3 viewDir = normalize(uCameraPos - vFragPos);

  /*
   * Global ambient: very dark purple-black to simulate
   * the ambient scatter from thousands of distant city lights.
   */
  vec3 color = vObjectColor * 0.04;

  /* ── Multi-light Blinn-Phong loop ────────────────────────────────── */
  for (int i = 0; i < MAX_LIGHTS; i++) {
    /*
     * GLSL 1.00 requires loop bounds to be compile-time constants,
     * so we use a runtime break instead of a variable upper bound.
     */
    if (i >= uNumLights) break;

    /* Direction and distance from fragment to this light. */
    vec3  toLight  = uLightPos[i] - vFragPos;
    float dist     = length(toLight);
    vec3  lightDir = toLight / dist;   /* normalised */

    /* ── Attenuation ─────────────────────────────────────────────────
     *
     * Quadratic falloff clamped at the configured radius.
     * atten² gives a softer, more physically plausible roll-off
     * compared to linear attenuation.
     */
    float atten = clamp(1.0 - dist / uLightRadius[i], 0.0, 1.0);
    atten = atten * atten;

    /* ── Diffuse (Lambertian) ─────────────────────────────────────── */
    float diff = max(dot(norm, lightDir), 0.0);

    /* ── Specular (Blinn-Phong) ───────────────────────────────────── */
    vec3  halfVec = normalize(lightDir + viewDir);
    float spec    = pow(max(dot(norm, halfVec), 0.0), 32.0);

    /* Combine: diffuse + specular, weighted by attenuation & intensity. */
    vec3 contrib = uLightColor[i] * uLightIntensity[i] * atten;
    color += vObjectColor * diff  * contrib;
    color += vObjectColor * spec  * contrib * 0.6; /* specular tint */
  }

  /* ── Emissive neon ───────────────────────────────────────────────── */
  /*
   * Emissive surfaces (neon signs, mission zones, wire sparks) glow
   * independently of the lighting loop. The multiplier makes them
   * punch through dark scenes even with no nearby lights.
   */
  color += vObjectColor * uEmissive * 2.5;

  /* ── Collision hit-flash ─────────────────────────────────────────── */
  color = mix(color, vec3(1.0, 0.05, 0.05), uHitFlash);

  /* ── Reinhard tone mapping ───────────────────────────────────────── */
  /*
   * Maps HDR values (>1.0) into [0,1] without clipping.
   * Applied per-channel so saturated neon colours remain vivid
   * rather than washing to white.
   */
  color = color / (color + vec3(1.0));

  /* ── Exponential distance fog ────────────────────────────────────── */
  /*
   * Quadratic exponential fog gives a faster density increase with
   * distance than linear fog, which looks more atmospheric in a
   * densely-lit city scene.
   *
   *   fogFactor = e^(-density * depth²)
   *
   * fogFactor = 1.0  →  fully visible (close)
   * fogFactor = 0.0  →  fully fogged  (far away)
   *
   * The fog colour is tinted with the ambient neon bleed so the haze
   * picks up the warm glow of the city rather than being a neutral grey.
   */
  float fogFactor = exp(-uFogDensity * vDepth * vDepth * 0.5);
  fogFactor = clamp(fogFactor, 0.0, 1.0);

  /* Add subtle neon bleed into the fog colour. */
  vec3 fogTinted = uFogColor + vec3(0.01, 0.0, 0.02);
  color = mix(fogTinted, color, fogFactor);

  gl_FragColor = vec4(color, 1.0);
}
