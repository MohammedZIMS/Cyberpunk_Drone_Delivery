import { mat4, vec3 } from 'https://cdn.jsdelivr.net/npm/gl-matrix@3.4.3/esm/index.js';

/** How far the camera trails behind the drone (world units). */
const FOLLOW_DISTANCE = 14;
/** How far above the drone the camera sits. */
const FOLLOW_HEIGHT   = 6;
/** Lerp speed — higher = snappier camera, lower = more cinematic lag. */
const LERP_SPEED      = 5;

export class Camera {
  constructor(canvas) {
    // Smoothed camera world position (lerped each frame)
    this._smoothPos = vec3.fromValues(0, 20, 30);

    this.position = vec3.clone(this._smoothPos);
    this.target   = vec3.fromValues(0, 0, 0);
    this.up       = vec3.fromValues(0, 1, 0);

    // Projection settings
    this.fovRad = Math.PI / 3.2;          // ~56°
    this.aspect = canvas.width / canvas.height;
    this.near   = 0.5;
    this.far    = 2200;

    window.addEventListener('resize', () => {
      this.aspect = canvas.width / canvas.height;
    });
  }

  // ── Per-frame update ─────────────────────────────────────────────────────

  /**
   * Move the camera to trail behind the drone.
   * @param {number[]} dronePos  [x, y, z]
   * @param {number}   droneYaw  radians
   * @param {number}   dt        delta-time in seconds
   */
  follow(dronePos, droneYaw, dt) {
    // Desired camera position: behind and slightly above the drone
    const cosY = Math.cos(droneYaw);
    const sinY = Math.sin(droneYaw);

    const desired = vec3.fromValues(
      dronePos[0] + sinY * FOLLOW_DISTANCE,
      dronePos[1] + FOLLOW_HEIGHT,
      dronePos[2] + cosY * FOLLOW_DISTANCE
    );

    // Exponential lerp — smooth but always converging
    const alpha = 1 - Math.exp(-LERP_SPEED * dt);
    vec3.lerp(this._smoothPos, this._smoothPos, desired, alpha);

    this.position = vec3.clone(this._smoothPos);
    this.target   = vec3.fromValues(dronePos[0], dronePos[1], dronePos[2]);
  }

  // ── Matrix getters ───────────────────────────────────────────────────────

  /** Build and return the view matrix (world → camera space). */
  getViewMatrix() {
    const m = mat4.create();
    mat4.lookAt(m, this.position, this.target, this.up);
    return m;
  }

  /** Build and return the projection matrix (camera → clip space). */
  getProjectionMatrix() {
    const m = mat4.create();
    mat4.perspective(m, this.fovRad, this.aspect, this.near, this.far);
    return m;
  }
}