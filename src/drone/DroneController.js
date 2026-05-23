// DroneController.js
// Wires drone physics → collision detection → HealthSystem.
// No longer owns damage constants — delegates to HealthSystem.

const BOUNCE_RESTITUTION = 0.28;

export class DroneController {
  constructor(drone, collisionDetector, healthSystem) {
    this.drone      = drone;
    this.detector   = collisionDetector;
    this.health     = healthSystem;   // HealthSystem instance

    /** Callback() — fires on any damaging collision (for FX/audio) */
    this.onHit = null;

    this._hitFlash   = 0;
    this._flashDur   = 0.7;
  }

  // ── Per-frame ─────────────────────────────────────────────────────────

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

      // Bounce velocity
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

      // Delegate ALL damage logic to HealthSystem (handles cooldown, pkg, type)
      const didDamage = this.health.processCollision(result);
      if (didDamage) {
        this._hitFlash = 1.0;
        if (this.onHit) this.onHit(result.obstacleType);
      }
    }

    if (this._hitFlash > 0) {
      this._hitFlash = Math.max(0, this._hitFlash - dt / this._flashDur);
    }
  }

  getHitFlash() { return this._hitFlash; }
}