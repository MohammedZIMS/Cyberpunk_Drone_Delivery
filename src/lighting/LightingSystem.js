/**
 * LightingSystem.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Assigns neon point lights to the tallest buildings and uploads them to the
 * GPU as flat uniform arrays (WebGL 1 doesn't support struct arrays).
 *
 * Concept covered: point lights, attenuation, uniform array upload.
 */

const MAX_LIGHTS = 32;

const NEON_COLORS = [
  [0.0, 1.0, 0.9], [1.0, 0.0, 0.7], [0.5, 0.0, 1.0],
  [1.0, 0.6, 0.0], [0.0, 0.8, 1.0], [1.0, 0.1, 0.3],
];

export class LightingSystem {
  constructor(buildings) {
    /** @type {{ position, color, intensity, radius }[]} */
    this.lights = [];
    this._spawnFromBuildings(buildings);

    // Pre-allocate flat arrays for GPU upload
    this._positions   = new Float32Array(MAX_LIGHTS * 3);
    this._colors      = new Float32Array(MAX_LIGHTS * 3);
    this._intensities = new Float32Array(MAX_LIGHTS);
    this._radii       = new Float32Array(MAX_LIGHTS);
    this._pack();
  }

  _spawnFromBuildings(buildings) {
    const sorted = [...buildings].sort((a, b) => b.height - a.height);

    for (const b of sorted) {
      if (this.lights.length >= MAX_LIGHTS) break;

      const color = NEON_COLORS[Math.floor(Math.random() * NEON_COLORS.length)];

      // Rooftop beacon
      this.lights.push({
        position:  [b.x, b.height + 1.8, b.z],
        color,
        intensity: 1.6 + Math.random() * 1.4,
        radius:    20 + Math.random() * 14,
      });

      // Mid-height sign light (tall buildings only)
      if (b.height > 28 && this.lights.length < MAX_LIGHTS) {
        this.lights.push({
          position:  [b.x + (Math.random()-0.5)*b.width, b.height*0.55, b.z + (Math.random()-0.5)*b.depth],
          color:     NEON_COLORS[Math.floor(Math.random() * NEON_COLORS.length)],
          intensity: 1.1,
          radius:    10 + Math.random() * 8,
        });
      }
    }
  }

  _pack() {
    for (let i = 0; i < this.lights.length; i++) {
      const L = this.lights[i];
      this._positions  [i*3]   = L.position[0];
      this._positions  [i*3+1] = L.position[1];
      this._positions  [i*3+2] = L.position[2];
      this._colors     [i*3]   = L.color[0];
      this._colors     [i*3+1] = L.color[1];
      this._colors     [i*3+2] = L.color[2];
      this._intensities[i]     = L.intensity;
      this._radii      [i]     = L.radius;
    }
  }

  /** Upload all light data to the currently bound shader program. */
  upload(gl, program) {
    gl.uniform1i (gl.getUniformLocation(program, 'uNumLights'),     this.lights.length);
    gl.uniform3fv(gl.getUniformLocation(program, 'uLightPos'),      this._positions);
    gl.uniform3fv(gl.getUniformLocation(program, 'uLightColor'),    this._colors);
    gl.uniform1fv(gl.getUniformLocation(program, 'uLightIntensity'),this._intensities);
    gl.uniform1fv(gl.getUniformLocation(program, 'uLightRadius'),   this._radii);
  }
}