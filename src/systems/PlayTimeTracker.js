export class PlayTimeTracker {
  constructor() {
    this._sessionStart  = null;   // performance.now() when session began
    this._activeTime    = 0;      // seconds spent actively playing (not paused)
    this._pausedTime    = 0;      // seconds spent in pause menu
    this._pauseStart    = null;   // performance.now() when paused
    this._running       = false;
    this._maxSpeed      = 0;      // m/s highest speed recorded this session
    this._distanceTraveled = 0;   // world units
  }

  // ── Lifecycle ────────────────────────────────────────────────────────

  start() {
    this._sessionStart = performance.now();
    this._activeTime   = 0;
    this._pausedTime   = 0;
    this._maxSpeed     = 0;
    this._distanceTraveled = 0;
    this._pauseStart   = null;
    this._running      = true;
  }

  pause() {
    if (!this._running || this._pauseStart !== null) return;
    this._pauseStart = performance.now();
  }

  resume() {
    if (!this._running || this._pauseStart === null) return;
    this._pausedTime += (performance.now() - this._pauseStart) / 1000;
    this._pauseStart = null;
  }

  stop() {
    if (!this._running) return;
    // Flush any open pause window
    if (this._pauseStart !== null) this.resume();
    this._running = false;
  }

  // ── Per-frame ────────────────────────────────────────────────────────

  /**
   * Call every active (non-paused) game frame.
   * @param {number} dt      - delta time seconds
   * @param {number} speed   - current drone speed m/s
   * @param {number} distDt  - distance moved this frame (world units)
   */
  update(dt, speed, distDt) {
    if (!this._running || this._pauseStart !== null) return;
    this._activeTime      += dt;
    this._distanceTraveled += distDt;
    if (speed > this._maxSpeed) this._maxSpeed = speed;
  }

  // ── Getters ─────────────────────────────────────────────────────────

  getActiveTime()    { return this._activeTime; }
  getPausedTime()    { return this._pausedTime; }
  getTotalTime()     { return this._activeTime + this._pausedTime; }
  getMaxSpeed()      { return this._maxSpeed; }
  getDistance()      { return this._distanceTraveled; }

  /** Format seconds as HH:MM:SS */
  static format(totalSeconds) {
    const s = Math.floor(totalSeconds);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return [h, m, sec].map(v => String(v).padStart(2, '0')).join(':');
  }

  getFormattedActive() { return PlayTimeTracker.format(this._activeTime); }
  getFormattedTotal()  { return PlayTimeTracker.format(this.getTotalTime()); }
}
