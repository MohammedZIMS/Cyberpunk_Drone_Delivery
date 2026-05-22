const STATES = {
  CLEAR:   { rain: 0,    fog: 0.002, wind: 0,   skyTint: [0.02, 0.00, 0.05] },
  DRIZZLE: { rain: 800,  fog: 0.006, wind: 2,   skyTint: [0.01, 0.01, 0.06] },
  STORM:   { rain: 4000, fog: 0.018, wind: 8,   skyTint: [0.00, 0.00, 0.03] },
  FOG:     { rain: 200,  fog: 0.028, wind: 1,   skyTint: [0.03, 0.03, 0.05] },
};

const TRANSITIONS = {
  CLEAR:   ['DRIZZLE', 'FOG'],
  DRIZZLE: ['STORM', 'FOG', 'CLEAR'],
  STORM:   ['DRIZZLE', 'CLEAR'],
  FOG:     ['CLEAR', 'DRIZZLE'],
};

const TRANSITION_MIN  = 30;
const TRANSITION_MAX  = 90;
const BLEND_DURATION  = 8.0;

export class WeatherSystem {
  constructor() {
    this.currentState = 'CLEAR';
    this.targetState  = 'CLEAR';

    // Live interpolated values (read by other systems)
    this.rain    = 0;
    this.fog     = STATES.CLEAR.fog;
    this.wind    = 0;
    this.skyTint = [...STATES.CLEAR.skyTint];

    this._windAngle   = Math.random() * Math.PI * 2;
    this._turbulenceT = 0;

    // FIX: timer starts at a random positive value — never 0 at boot
    this._timer        = this._nextDuration();
    this._transitioning = false;
    this._blendT        = 0;
  }

  // ── Per-frame update ──────────────────────────────────────────────────────

  update(dt) {
    this._timer -= dt;

    // FIX: only start a new transition when NOT already transitioning
    if (this._timer <= 0 && !this._transitioning) {
      this._startTransition();
    }

    if (this._transitioning) {
      this._blendT += dt / BLEND_DURATION;

      if (this._blendT >= 1.0) {
        this._blendT        = 1.0;
        this._interpolate(1.0);       // ensure we land exactly on target
        this.currentState   = this.targetState;
        this._transitioning = false;
        // FIX: reset timer HERE (after transition) not in _startTransition
        this._timer         = this._nextDuration();
      } else {
        this._interpolate(this._blendT);
      }
    }

    // Wind direction drifts slowly and independently of weather state
    this._windAngle   += 0.04 * dt;
    this._turbulenceT += dt;
  }

  _startTransition() {
    const options       = TRANSITIONS[this.currentState];
    this.targetState    = options[Math.floor(Math.random() * options.length)];
    this._transitioning = true;
    this._blendT        = 0;
    // FIX: do NOT touch this._timer here — it stays negative/zero until
    // the transition completes and we reset it above
  }

  _interpolate(t) {
    const s = t * t * (3 - 2 * t); // smooth-step
    const A = STATES[this.currentState];
    const B = STATES[this.targetState];

    this.rain = A.rain + (B.rain - A.rain) * s;
    this.fog  = A.fog  + (B.fog  - A.fog)  * s;
    this.wind = A.wind + (B.wind - A.wind)  * s;

    for (let i = 0; i < 3; i++) {
      this.skyTint[i] = A.skyTint[i] + (B.skyTint[i] - A.skyTint[i]) * s;
    }
  }

  _nextDuration() {
    return TRANSITION_MIN + Math.random() * (TRANSITION_MAX - TRANSITION_MIN);
  }

  // ── Wind force ────────────────────────────────────────────────────────────

  getWindForce() {
    if (this.wind < 0.01) return [0, 0, 0];

    const turb = Math.sin(this._turbulenceT * 1.3) * 0.4
               + Math.sin(this._turbulenceT * 2.7) * 0.25
               + Math.sin(this._turbulenceT * 0.5) * 0.35;

    const strength = this.wind * (1.0 + turb);

    return [
      Math.cos(this._windAngle) * strength,
      Math.sin(this._turbulenceT * 0.8) * this.wind * 0.15,
      Math.sin(this._windAngle) * strength,
    ];
  }

  // ── Accessors ─────────────────────────────────────────────────────────────

  getParticleCount() { return Math.floor(this.rain); }
  getFogDensity()    { return this.fog; }

  /** Always clamp to [0,1] to guard against float precision drift. */
  getSkyTint() {
    return this.skyTint.map(v => Math.max(0, Math.min(1, v)));
  }

  /** Returns the settled current state (not the in-progress target). */
  getStateName() { return this.currentState; }
}
