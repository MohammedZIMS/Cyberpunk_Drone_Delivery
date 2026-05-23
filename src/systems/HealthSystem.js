// src/systems/HealthSystem.js
// Centralised HP, damage cooldown, and collision consequence system.
//
// ROOT CAUSES fixed:
//  1. DroneController applied a FLAT 20 HP per hit regardless of obstacle type.
//     Wires, billboards and cars all dealt identical damage — wrong and unfair.
//  2. No cooldown: a single frame of wire-overlap could fire 60 damage callbacks
//     before the push-out resolved, draining full HP in one frame.
//  3. Package condition was never tracked — delivery score was always max.
//  4. "isDamaging" threshold was 4 m/s for everything, meaning low-speed
//     brush contacts still caused full damage.

// Damage table (HP lost per qualifying impact)
export const DAMAGE_TABLE = {
  building:  20,
  car:       25,
  billboard: 10,
  wire:      15,
  ground:     5,
};

// Minimum speed (m/s) that counts as a damaging hit per type
export const DAMAGE_SPEED = {
  building:  3.0,
  car:       2.0,
  billboard: 2.0,
  wire:      1.5,  // wires are hard to see — lower threshold
  ground:    4.0,
};

// Package condition reduction per impact (relative to HP damage)
export const PKG_DAMAGE_RATIO = {
  building:  1.5,
  car:       2.0,
  billboard: 0.8,
  wire:      1.2,
  ground:    0.6,
};

const COOLDOWN_SEC    = 0.55;   // global damage cooldown after any hit
const MAX_HP          = 100;
const MAX_PKG         = 100;

export class HealthSystem {
  constructor() {
    this.hp            = MAX_HP;
    this.pkgCondition  = MAX_PKG;  // 0-100; drops on hard hits while carrying
    this.isAlive       = true;

    this._cooldown     = 0;        // seconds until next damage allowed
    this._carryingPkg  = false;    // only reduce pkg condition when carrying

    // Callbacks
    this.onDamage      = null;     // fn(amount, type)
    this.onDeath       = null;     // fn()
    this.onPkgDamage   = null;     // fn(amount, newCondition)
    this.onPkgFail     = null;     // fn()
  }

  // ── Called each frame ────────────────────────────────────────────────

  update(dt) {
    if (this._cooldown > 0) this._cooldown = Math.max(0, this._cooldown - dt);
  }

  // ── External API ─────────────────────────────────────────────────────

  /** Tell the health system whether the drone currently holds a package. */
  setCarryingPackage(carrying) { this._carryingPkg = carrying; }

  /**
   * Process a collision result from CollisionDetector.check().
   * Returns true if damage was actually applied this call.
   */
  processCollision(collisionResult) {
    if (!this.isAlive)         return false;
    if (!collisionResult.hit)  return false;
    if (this._cooldown > 0)    return false;  // still in cooldown

    const type  = collisionResult.obstacleType || 'building';
    const speed = collisionResult.impactSpeed   || 0;
    const minSpd = DAMAGE_SPEED[type] ?? 2.5;

    if (speed < minSpd) return false;  // too gentle to hurt

    // HP damage — scale by speed (faster = worse), but cap at 2× table value
    const rawDmg    = DAMAGE_TABLE[type] ?? 15;
    const speedMult = Math.min(2.0, 1.0 + (speed - minSpd) / 8);
    const hpDmg     = Math.round(rawDmg * speedMult);

    this._applyHpDamage(hpDmg, type);

    // Package condition damage (only when carrying)
    if (this._carryingPkg) {
      const pkgDmg = Math.round(hpDmg * (PKG_DAMAGE_RATIO[type] ?? 1.0));
      this._applyPkgDamage(pkgDmg);
    }

    // Start cooldown so next frame doesn't re-fire
    this._cooldown = COOLDOWN_SEC;
    return true;
  }

  /** Direct HP damage (e.g., mission timeout penalty). */
  applyDirect(amount) {
    if (!this.isAlive) return;
    this._applyHpDamage(amount, 'direct');
  }

  /** Reset for a new game session. */
  reset() {
    this.hp           = MAX_HP;
    this.pkgCondition = MAX_PKG;
    this.isAlive      = true;
    this._cooldown    = 0;
  }

  /** Reset package condition when a new package is picked up. */
  resetPackage() {
    this.pkgCondition = MAX_PKG;
  }

  // Getters
  getHP()           { return this.hp; }
  getHPPercent()    { return this.hp / MAX_HP * 100; }
  getPkgCondition() { return this.pkgCondition; }
  getPkgPercent()   { return this.pkgCondition / MAX_PKG * 100; }
  getCooldown()     { return this._cooldown; }
  inCooldown()      { return this._cooldown > 0; }

  // ── Private ──────────────────────────────────────────────────────────

  _applyHpDamage(amount, type) {
    this.hp = Math.max(0, this.hp - amount);
    if (this.onDamage) this.onDamage(amount, type);
    if (this.hp <= 0 && this.isAlive) {
      this.isAlive = false;
      if (this.onDeath) this.onDeath();
    }
  }

  _applyPkgDamage(amount) {
    this.pkgCondition = Math.max(0, this.pkgCondition - amount);
    if (this.onPkgDamage) this.onPkgDamage(amount, this.pkgCondition);
    if (this.pkgCondition <= 0 && this.onPkgFail) this.onPkgFail();
  }
}
