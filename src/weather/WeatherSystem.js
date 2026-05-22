// src/weather/WeatherSystem.js

const STATES = {
  CLEAR:   { rain: 0,    fog: 0.002, wind: 0,   skyTint: [0.02, 0.00, 0.05] },
  DRIZZLE: { rain: 800,  fog: 0.006, wind: 2,   skyTint: [0.01, 0.01, 0.06] },
  STORM:   { rain: 4000, fog: 0.018, wind: 8,   skyTint: [0.00, 0.00, 0.03] },
  FOG:     { rain: 200,  fog: 0.028, wind: 1,   skyTint: [0.03, 0.03, 0.05] },
};

// Which states can follow which
const TRANSITIONS = {
  CLEAR:   ['DRIZZLE', 'FOG'],
  DRIZZLE: ['STORM',   'FOG',   'CLEAR'],
  STORM:   ['DRIZZLE', 'CLEAR'],
  FOG:     ['CLEAR',   'DRIZZLE'],
};

const TRANSITION_MIN = 30;  // seconds before next change
const TRANSITION_MAX = 90;

export class WeatherSystem {
  constructor() {
    this.currentState = 'CLEAR';
    this.targetState  = 'CLEAR';

    // Smoothly interpolated current values
    this.rain    = 0;
    this.fog     = STATES.CLEAR.fog;
    this.wind    = 0;
    this.skyTint = [...STATES.CLEAR.skyTint];

    // Wind direction (world XZ), rotates slowly over time
    this._windAngle     = Math.random() * Math.PI * 2;
    this._windAngleVel  = 0.05; // rad/s drift
    this._turbulenceT   = 0;    // time accumulator for turbulence noise

    // Transition timer
    this._timer       = this._nextDuration();
    this._transitioning = false;
    this._blendT        = 0;    // 0 → 1 during blend
    this._blendDuration = 8.0;  // seconds to crossfade between states
  }

  // ── Per-frame update ──────────────────────────────────────────────

  update(dt) {
    this._timer -= dt;

    if (this._timer <= 0 && !this._transitioning) {
      this._startTransition();
    }

    if (this._transitioning) {
      this._blendT += dt / this._blendDuration;
      if (this._blendT >= 1.0) {
        this._blendT      = 1.0;
        this.currentState  = this.targetState;
        this._transitioning = false;
        this._timer        = this._nextDuration();
      }
      this._interpolate(this._blendT);
    }

    // Slowly rotate wind direction
    this._windAngle    += this._windAngleVel * dt;
    this._turbulenceT  += dt;
  }

  _startTransition() {
    const options     = TRANSITIONS[this.currentState];
    this.targetState  = options[Math.floor(Math.random() * options.length)];
    this._transitioning = true;
    this._blendT      = 0;
  }

  _interpolate(t) {
    // Smooth-step easing
    const s = t * t * (3 - 2 * t);
    const A = STATES[this.currentState];
    const B = STATES[this.targetState];

    this.rain = A.rain + (B.rain - A.rain) * s;
    this.fog  = A.fog  + (B.fog  - A.fog)  * s;
    this.wind = A.wind + (B.wind - A.wind) * s;

    for (let i = 0; i < 3; i++) {
      this.skyTint[i] = A.skyTint[i] + (B.skyTint[i] - A.skyTint[i]) * s;
    }
  }

  _nextDuration() {
    return TRANSITION_MIN +
      Math.random() * (TRANSITION_MAX - TRANSITION_MIN);
  }

  // ── Wind force (call from DronePhysics) ──────────────────────────

  // Returns [wx, wy, wz] force vector in world space
  getWindForce() {
    if (this.wind < 0.01) return [0, 0, 0];

    // Turbulence: two sine waves at different frequencies
    const turb = Math.sin(this._turbulenceT * 1.3) * 0.4 +
                 Math.sin(this._turbulenceT * 2.7) * 0.25 +
                 Math.sin(this._turbulenceT * 0.5) * 0.35;

    const strength = this.wind * (1.0 + turb);

    return [
      Math.cos(this._windAngle) * strength,
      Math.sin(this._turbulenceT * 0.8) * this.wind * 0.15, // slight vertical buffet
      Math.sin(this._windAngle) * strength,
    ];
  }

  // ── Accessors ─────────────────────────────────────────────────────

  getParticleCount() { return Math.floor(this.rain); }
  getFogDensity()    { return this.fog; }
  getSkyTint() {
  return this.skyTint.map(v =>
    Math.max(0, Math.min(1, v))
  );
}
  getStateName()     { return this.currentState; }
}