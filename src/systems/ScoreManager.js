// ── Score constants ───────────────────────────────────────────────────────

// Base points
const PICKUP_BASE     = 200;   // reward just for reaching the package
const DELIVERY_BASE   = 600;   // reward for completing delivery

// Bonuses
const PICKUP_SPEED_B  = 150;   // max bonus for reaching pickup quickly
const TIME_BONUS_MAX  = 400;   // max delivery time bonus
const PKG_COND_MAX    = 300;   // max package-condition bonus (100% = full 300)
const CLEAN_RUN_B     = 500;   // no collisions entire mission
const ACCURACY_B      = 200;   // "precision landing" — low approach speed

// Weather bonuses
const WEATHER_BONUS = {
  STORM:  300,
  RAIN:   150,
  FOG:    100,
  NIGHT:  100,
  CLEAR:    0,
};

// Streak multiplier table
const MULTS = [1.0, 1.2, 1.5, 1.8, 2.2, 2.6, 3.0];

export class ScoreManager {
  constructor() {
    this.score      = 0;
    this.streak     = 0;
    this.deliveries = 0;
    this.pickups    = 0;
    this.highScore  = parseInt(localStorage.getItem('droneHi2') || '0');

    // Tracks whether the current mission had ANY collision damage
    this._missionClean      = true;
    this._missionStartTime  = 0;  // seconds since session start at mission spawn
    this._sessionTime       = 0;  // injected each frame by main.js
  }

  // ── Lifecycle ────────────────────────────────────────────────────────

  reset() {
    this.score      = 0;
    this.streak     = 0;
    this.deliveries = 0;
    this.pickups    = 0;
    this._missionClean = true;
    this._missionStartTime = 0;
  }

  /** Call when a new mission spawns so pickup speed timer resets. */
  onMissionSpawn(sessionTimeSec) {
    this._missionStartTime = sessionTimeSec;
    this._missionClean     = true;
  }

  /** Call when the drone takes any collision damage this mission. */
  onCollision() {
    this._missionClean = false;
  }

  // ── Pickup reward ─────────────────────────────────────────────────────

  /**
   * Called the moment the drone picks up a package.
   * @param {number} sessionTimeSec  Current session active time
   * @returns {{ earned, speedBonus }}
   */
  recordPickup(sessionTimeSec) {
    const elapsed   = sessionTimeSec - this._missionStartTime;
    // Speed bonus: full 150 pts if reached in < 8 s, scales to 0 at 60 s+
    const speedBonus = Math.max(0, Math.round(
      PICKUP_SPEED_B * Math.max(0, 1 - elapsed / 60)
    ));
    const earned = PICKUP_BASE + speedBonus;

    this.score   += earned;
    this.pickups += 1;
    this._saveHigh();
    return { earned, speedBonus };
  }

  // ── Delivery reward ───────────────────────────────────────────────────

  /**
   * Called when the drone successfully drops off a package.
   * @param {number} timeLeft       Seconds remaining on mission timer
   * @param {number} timeLimit      Total mission time limit (seconds)
   * @param {number} pkgCondition   Package condition 0–100
   * @param {number} approachSpeed  Drone speed at moment of dropoff (m/s)
   * @param {string} weatherName    Current weather state
   * @returns {{ earned, timeBonus, pkgBonus, weatherBonus, cleanBonus, accuracyBonus, mult }}
   */
  recordDelivery(timeLeft, timeLimit, pkgCondition, approachSpeed, weatherName) {
    const timeFrac    = Math.max(0, timeLeft / timeLimit);
    const timeBonus   = Math.round(TIME_BONUS_MAX * timeFrac);
    const pkgBonus    = Math.round(PKG_COND_MAX   * (pkgCondition / 100));
    const weatherBonus= WEATHER_BONUS[weatherName] ?? 0;
    const cleanBonus  = this._missionClean ? CLEAN_RUN_B : 0;
    // Accuracy: full 200 pts if approach speed < 3 m/s, 0 at 12 m/s+
    const accuracyBonus = Math.max(0, Math.round(
      ACCURACY_B * Math.max(0, 1 - (approachSpeed - 3) / 9)
    ));

    const mult  = MULTS[Math.min(this.streak, MULTS.length - 1)];
    const sub   = DELIVERY_BASE + timeBonus + pkgBonus + weatherBonus
                + cleanBonus + accuracyBonus;
    const earned = Math.round(sub * mult);

    this.score      += earned;
    this.deliveries += 1;
    this.streak     += 1;
    this._saveHigh();

    return { earned, timeBonus, pkgBonus, weatherBonus, cleanBonus, accuracyBonus, mult };
  }

  // ── Failure ───────────────────────────────────────────────────────────

  resetStreak() {
    this.streak = 0;
  }

  /** Penalty for mission timeout. */
  applyTimeoutPenalty(undeliveredCount) {
    const penalty = undeliveredCount * 300;
    this.score    = Math.max(0, this.score - penalty);
    this.streak   = 0;
    return penalty;
  }

  // ── Getters ───────────────────────────────────────────────────────────

  getScore()      { return this.score; }
  getHighScore()  { return this.highScore; }
  getStreak()     { return this.streak; }
  getDeliveries() { return this.deliveries; }
  getPickups()    { return this.pickups; }
  getMult()       { return MULTS[Math.min(this.streak, MULTS.length - 1)]; }

  // ── Private ───────────────────────────────────────────────────────────

  _saveHigh() {
    if (this.score > this.highScore) {
      this.highScore = this.score;
      localStorage.setItem('droneHi2', this.highScore);
    }
  }
}
