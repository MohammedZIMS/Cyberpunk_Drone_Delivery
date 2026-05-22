/**
 * city.vert
 * Vertex shader for all scene geometry: buildings, drone, obstacles,
 * mission zones. Performs MVP transform and forwards per-vertex data
 * to the fragment shader for Blinn-Phong lighting.
 *
 * Attributes:
 *   aPosition    vec3   Object-space vertex position
 *   aNormal      vec3   Object-space vertex normal
 *
 * Uniforms (matrices):
 *   uModel       mat4   Object → World transform
 *   uView        mat4   World  → Camera (view) transform
 *   uProjection  mat4   Camera → Clip space (perspective) transform
 *
 * Uniforms (material):
 *   uObjectColor vec3   Base diffuse colour of this draw call
 *
 * Varyings (→ city.frag):
 *   vNormal      vec3   World-space normal (normalised in frag shader)
 *   vFragPos     vec3   World-space fragment position for lighting
 *   vObjectColor vec3   Passed-through base colour
 *   vDepth       float  Camera-space depth (positive) – used for fog
 */

attribute vec3 aPosition;
attribute vec3 aNormal;

uniform mat4 uModel;
uniform mat4 uView;
uniform mat4 uProjection;
uniform vec3 uObjectColor;

varying vec3  vNormal;
varying vec3  vFragPos;
varying vec3  vObjectColor;
varying float vDepth;

void main() {
  /* Transform vertex into world space. */
  vec4 worldPos = uModel * vec4(aPosition, 1.0);

  /* World-space position used in per-fragment lighting. */
  vFragPos = worldPos.xyz;

  /*
   * Transform the normal into world space.
   * We use mat3(uModel) which works correctly for uniform-scale objects.
   * For non-uniform scale the inverse-transpose would be required.
   */
  vNormal = normalize(mat3(uModel) * aNormal);

  /* Pass colour through unchanged. */
  vObjectColor = uObjectColor;

  /*
   * Camera-space Z depth (negated because OpenGL looks down -Z).
   * Used in city.frag for exponential distance fog.
   */
  vec4 viewPos = uView * worldPos;
  vDepth       = -viewPos.z;

  /* Final clip-space position. */
  gl_Position = uProjection * viewPos;
}
