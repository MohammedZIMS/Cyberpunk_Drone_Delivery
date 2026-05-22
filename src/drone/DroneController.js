const BOUNCE_RESTITUTION = 0.3;
const DAMAGE_PER_HIT     = 20;
const HIT_FLASH_DUR      = 0.9; // seconds

export class DroneController {
  constructor(drone, collisionDetector) {
    this.drone    = drone;
    this.detector = collisionDetector;

    /** Callback(damageAmount) — wired to GameState.applyDamage by main.js */
    this.onDamage = null;
    /** Callback() — fires once when a damaging hit occurs (for FX/audio) */
    this.onHit    = null;

    this._hitFlash = 0;
  }

  // ── Per-frame ─────────────────────────────────────────────────────────────

  update(dt, input) {
    this.drone.update(dt, input);

    const pos = this.drone.getPosition();
    const vel = this.drone.getVelocity();

    const result = this.detector.check(pos, vel);

    if (result.hit) {
      // Push out of penetrating geometry
      pos[0] += result.push[0];
      pos[1] += result.push[1];
      pos[2] += result.push[2];

      // Reflect velocity (mirror + damping)
      const vDotN = vel[0]*result.normal[0]
                  + vel[1]*result.normal[1]
                  + vel[2]*result.normal[2];
      const r = 1 + BOUNCE_RESTITUTION;
      vel[0] -= r * vDotN * result.normal[0];
      vel[1] -= r * vDotN * result.normal[1];
      vel[2] -= r * vDotN * result.normal[2];
      vel[0] *= BOUNCE_RESTITUTION;
      vel[1] *= BOUNCE_RESTITUTION;
      vel[2] *= BOUNCE_RESTITUTION;

      if (result.isDamaging) {
        this._hitFlash = HIT_FLASH_DUR;
        if (this.onDamage) this.onDamage(DAMAGE_PER_HIT);
        if (this.onHit)    this.onHit();
      }
    }

    if (this._hitFlash > 0) {
      this._hitFlash = Math.max(0, this._hitFlash - dt / HIT_FLASH_DUR);
    }
  }

  getHitFlash() { return this._hitFlash; }
}
