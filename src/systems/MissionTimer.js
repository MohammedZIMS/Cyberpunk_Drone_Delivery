const BASE_TIME      = 90;      // seconds — generous base for all missions
const METERS_PER_SEC = 1.8;     // additional seconds per world-unit of distance
const MIN_TIME       = 60;      // shortest possible mission (seconds)
const MAX_TIME       = 240;     // longest possible mission (seconds)

const WARN_YELLOW    = 20;      // seconds remaining → yellow warning
const WARN_RED       = 8;       // seconds remaining → red flash

export class MissionTimer {
  constructor() {
    this._limit    = BASE_TIME;
    this._elapsed  = 0;
    this._running  = false;

    // Callbacks
    this.onExpire  = null;   // fn()
    this.onWarn    = null;   // fn(level) — level: 'yellow' | 'red'

    this._warned   = { yellow: false, red: false };
  }

  // ── Lifecycle ────────────────────────────────────────────────────────

  /**
   * Start a new mission timer scaled to the distance between positions.
   * @param {number[]} pickupPos   [x, y, z]
   * @param {number[]} dropoffPos  [x, y, z]
   */
  startMission(pickupPos, dropoffPos) {
    const dist = MissionTimer.distance3D(pickupPos, dropoffPos);
    this._limit   = Math.min(MAX_TIME, Math.max(MIN_TIME,
      BASE_TIME + dist * METERS_PER_SEC));
    this._elapsed = 0;
    this._running = true;
    this._warned  = { yellow: false, red: false };
  }

  stop()   { this._running = false; }
  reset()  { this._elapsed = 0; this._running = false; }

  // ── Per-frame ────────────────────────────────────────────────────────

  update(dt) {
    if (!this._running) return;
    this._elapsed += dt;

    const left = this.getRemaining();

    // Trigger yellow warning once
    if (!this._warned.yellow && left <= WARN_YELLOW && left > WARN_RED) {
      this._warned.yellow = true;
      if (this.onWarn) this.onWarn('yellow');
    }
    // Trigger red warning once
    if (!this._warned.red && left <= WARN_RED) {
      this._warned.red = true;
      if (this.onWarn) this.onWarn('red');
    }
    // Expiry
    if (this._elapsed >= this._limit) {
      this._running = false;
      if (this.onExpire) this.onExpire();
    }
  }

  // ── Getters ──────────────────────────────────────────────────────────

  getRemaining()   { return Math.max(0, this._limit - this._elapsed); }
  getLimit()       { return this._limit; }
  getElapsed()     { return this._elapsed; }
  getFraction()    { return Math.min(1, this._elapsed / this._limit); }
  isRunning()      { return this._running; }

  /** 'ok' | 'yellow' | 'red' */
  getWarningLevel() {
    const left = this.getRemaining();
    if (left <= WARN_RED)    return 'red';
    if (left <= WARN_YELLOW) return 'yellow';
    return 'ok';
  }

  // ── Static helpers ───────────────────────────────────────────────────

  static distance3D(a, b) {
    return Math.sqrt(
      (a[0]-b[0])**2 + (a[1]-b[1])**2 + (a[2]-b[2])**2);
  }
}
