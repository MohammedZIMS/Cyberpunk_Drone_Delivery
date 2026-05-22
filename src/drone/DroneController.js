// src/drone/DroneController.js

const BOUNCE_DAMPING  = 0.3;   // fraction of velocity kept after bounce
const MAX_HEALTH      = 100;
const DAMAGE_PER_HIT  = 20;    // health lost on a hard impact

export class DroneController {
  constructor(drone, collisionDetector) {
    this.drone    = drone;
    this.detector = collisionDetector;
    this.health   = MAX_HEALTH;
    this.isAlive  = true;

    // Flash effect timing
    this._hitFlash    = 0;    // counts down from 1 after a hit
    this._justHit     = false;
  }

  update(dt, input) {
    if (!this.isAlive) return;

    // 1. Run normal drone physics
    this.drone.update(dt, input);

    const pos = this.drone.getPosition();
    const vel = this.drone.getVelocity();

    // 2. Check collisions
    const result = this.detector.check(pos, vel);

    if (result.hit) {
      // Push drone out of penetrating geometry
      pos[0] += result.push[0];
      pos[1] += result.push[1];
      pos[2] += result.push[2];

      // Reflect velocity along collision normal, with damping
      // v' = v - (1 + restitution) * (v·n) * n
      const vDotN = vel[0] * result.normal[0] +
                    vel[1] * result.normal[1] +
                    vel[2] * result.normal[2];

      vel[0] -= (1 + BOUNCE_DAMPING) * vDotN * result.normal[0];
      vel[1] -= (1 + BOUNCE_DAMPING) * vDotN * result.normal[1];
      vel[2] -= (1 + BOUNCE_DAMPING) * vDotN * result.normal[2];

      // Scale remaining velocity down (energy lost to impact)
      vel[0] *= BOUNCE_DAMPING;
      vel[1] *= BOUNCE_DAMPING;
      vel[2] *= BOUNCE_DAMPING;

      // Trigger damage on hard impacts
      if (result.isDamaging) {
        this.health     -= DAMAGE_PER_HIT;
        this._justHit    = true;
        this._hitFlash   = 1.0;

        if (this.health <= 0) {
          this.health  = 0;
          this.isAlive = false;
          this._onDeath();
        }
      }
    }

    // Cool down hit flash
    if (this._hitFlash > 0) {
      this._hitFlash -= dt * 3;
      this._justHit   = this._hitFlash > 0;
    }
  }

  _onDeath() {
    console.log('Drone destroyed!');
    // You'll add particle explosion here in Week 7
    document.getElementById('hud-pkg').textContent = '!! DESTROYED !!';
  }

  getHitFlash()   { return Math.max(0, this._hitFlash); }
  getHealth()     { return this.health; }
  isHit()         { return this._justHit; }
}