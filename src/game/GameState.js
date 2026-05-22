const MAX_PARCELS = 8;
export const WAVE_TIME = 90;

export class GameState {
  constructor(cityBuildings, scoreSystem) {
    this.buildings   = cityBuildings;
    this.scoreSystem = scoreSystem;

    // ── Core flags ─────────────────────────────────────────────────
    /** True while the game loop should process physics/AI/score. */
    this.isPlaying = false;
    /** True while the game is paused (ESC / P). Render still runs. */
    this.isPaused  = false;
    /** False after the drone is destroyed. */
    this.isAlive   = true;

    // ── Wave / mission state ────────────────────────────────────────
    this.wave        = 1;
    this.timer       = WAVE_TIME;
    this.parcelCount = 0;
    this.parcels     = [];

    // ── HP ──────────────────────────────────────────────────────────
    this.hp = 100;

    // ── Callbacks ───────────────────────────────────────────────────
    this.onWaveChange = null;
    this.onGameOver   = null;
    this.onDeath      = null;
  }

  // ── Lifecycle ────────────────────────────────────────────────────

  startGame() {
    this.isPlaying = true;
    this.isPaused  = false;
    this.isAlive   = true;
    this.wave      = 1;
    this.hp        = 100;
    this.scoreSystem.reset();
    this.spawnWave(3);
  }

  reset() {
    this.isAlive = true;
    this.wave    = 1;
    this.hp      = 100;
    this.timer   = WAVE_TIME;
    this.scoreSystem.reset();
    this.spawnWave(3);
  }

  // ── Pause system ─────────────────────────────────────────────────

  togglePause() {
    this.isPaused = !this.isPaused;
    return this.isPaused;
  }

  pause()  { this.isPaused = true;  }
  resume() { this.isPaused = false; }

  // ── Wave management ──────────────────────────────────────────────

  spawnWave(count = 3) {
    this.timer       = WAVE_TIME;
    this.parcelCount = Math.min(count, MAX_PARCELS);
    this.parcels     = [];

    const shuffled = [...this.buildings]
      .filter(b => b.height > 18)
      .sort(() => Math.random() - 0.5);

    for (let i = 0; i < this.parcelCount; i++) {
      this.parcels.push({
        building: shuffled[i % shuffled.length],
        delivered: false,
      });
    }

    if (this.onWaveChange) this.onWaveChange(this.wave, this.parcelCount);
  }

  // ── Per-frame update — called ONCE per game loop tick ───────────

  /**
   * @param {number} dt          Delta-time in seconds (never called when paused)
   * @param {string} weatherName Current weather state name
   */
  update(dt, weatherName) {
    // Guard: never update when paused, dead, or not yet started
    if (!this.isPlaying || this.isPaused || !this.isAlive) return;

    this.timer -= dt;

    if (this.timer <= 0) {
      this._handleWaveTimeout();
      this._nextWave();
    }

    // All-delivered check happens every frame via deliverParcel() callbacks
  }

  // ── Delivery ─────────────────────────────────────────────────────

  /**
   * Mark parcel at index as delivered. Returns score result or null.
   * Safe to call multiple times (idempotent after first delivery).
   */
  deliverParcel(index, weatherName) {
    const p = this.parcels[index];
    if (!p || p.delivered) return null;

    p.delivered = true;

    const result = this.scoreSystem.recordDelivery(this.timer, weatherName);

    // Check if wave is now complete
    if (this.parcels.every(p => p.delivered)) {
      // Small delay so the player can see the last delivery flash
      setTimeout(() => this._nextWave(), 1800);
    }

    return result;
  }

  // ── HP / damage ──────────────────────────────────────────────────

  applyDamage(amount) {
    if (!this.isAlive) return;
    this.hp = Math.max(0, this.hp - amount);
    if (this.hp <= 0) this._triggerDeath();
  }

  _triggerDeath() {
    this.isAlive   = false;
    this.isPlaying = false;
    if (this.onDeath) this.onDeath();
  }

  // ── Wave progression ─────────────────────────────────────────────

  _nextWave() {
    this.wave++;
    const nextCount = Math.min(3 + (this.wave - 1), MAX_PARCELS);
    this.spawnWave(nextCount);
  }

  _handleWaveTimeout() {
    let penalty = 0;
    for (const p of this.parcels) {
      if (!p.delivered) penalty += 200;
    }
    this.scoreSystem.score = Math.max(0, this.scoreSystem.score - penalty);
  }

  // ── Getters ──────────────────────────────────────────────────────

  getWave()          { return this.wave; }
  getTimeRemaining() { return Math.max(0, this.timer); }
  getParcels()       { return this.parcels; }
  getHP()            { return this.hp; }
}
