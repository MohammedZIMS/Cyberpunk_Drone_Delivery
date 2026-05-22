const MAX_PARCELS = 8;
const WAVE_TIME   = 90; // seconds per wave

export class GameState {
  constructor(cityBuildings, scoreSystem) {
    this.buildings   = cityBuildings;
    this.scoreSystem = scoreSystem;

    // ── wave state ─────────────────────────────
    this.wave        = 1;
    this.parcelCount = 0;
    this.timer       = WAVE_TIME;

    this.parcels = [];

    this._onWaveChange = null;
    this._onGameOver   = null;
  }

  // ─────────────────────────────────────────────
  // CALLBACKS
  // ─────────────────────────────────────────────

  onWaveChange(fn) {
    this._onWaveChange = fn;
  }

  onGameOver(fn) {
    this._onGameOver = fn;
  }

  // ─────────────────────────────────────────────
  // WAVE SYSTEM
  // ─────────────────────────────────────────────

  spawnWave(count = 3) {
    this.parcels = [];
    this.timer = WAVE_TIME;

    this.parcelCount = Math.min(count, MAX_PARCELS);

    const shuffled = [...this.buildings]
      .sort(() => Math.random() - 0.5);

    for (let i = 0; i < this.parcelCount; i++) {
      const b = shuffled[i % shuffled.length];

      this.parcels.push({
        building: b,
        delivered: false,
      });
    }

    if (this._onWaveChange) {
      this._onWaveChange(this.wave, this.parcelCount);
    }
  }

  // ─────────────────────────────────────────────
  // UPDATE LOOP
  // ─────────────────────────────────────────────

  update(dt, weather = 'CLEAR') {
    this.timer -= dt;

    // ── wave timeout ──────────────────────────
    if (this.timer <= 0) {
      this._handleWaveTimeout();
      this._nextWave();
      return;
    }

    // ── check completion ──────────────────────
    const allDone = this.parcels.every(p => p.delivered);

    if (allDone) {
      this._nextWave();
    }
  }

  // ─────────────────────────────────────────────
  // DELIVERY HANDLING
  // ─────────────────────────────────────────────

  deliverParcel(index, timeLeft, weather) {
    const parcel = this.parcels[index];
    if (!parcel || parcel.delivered) return null;

    parcel.delivered = true;

    // score system hook
    return this.scoreSystem.recordDelivery(timeLeft, weather);
  }

  // ─────────────────────────────────────────────
  // WAVE PROGRESSION
  // ─────────────────────────────────────────────

  _nextWave() {
    this.wave += 1;

    const nextCount = Math.min(
      3 + (this.wave - 1), // +1 per wave
      MAX_PARCELS
    );

    this.spawnWave(nextCount);
  }

  // ─────────────────────────────────────────────
  // TIMEOUT PENALTY SYSTEM
  // ─────────────────────────────────────────────

  _handleWaveTimeout() {
    let penalty = 0;

    for (const p of this.parcels) {
      if (!p.delivered) {
        penalty += 200; // per missed parcel penalty
      }
    }

    this.scoreSystem.score = Math.max(
      0,
      this.scoreSystem.score - penalty
    );

    if (this._onGameOver && this.wave > 6) {
      this._onGameOver({
        reason: 'timeout',
        wave: this.wave,
        penalty
      });
    }
  }

  // ─────────────────────────────────────────────
  // GETTERS
  // ─────────────────────────────────────────────

  getWave() {
    return this.wave;
  }

  getTimeRemaining() {
    return Math.max(0, this.timer);
  }

  getParcelCount() {
    return this.parcelCount;
  }

  getParcels() {
    return this.parcels;
  }
}