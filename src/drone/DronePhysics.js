// Physics constants (tune to taste)
const GRAVITY         =  9.8;   // m/s²
const THRUST_FORCE    = 28.0;   // was 20 — faster climb   // N upward (must exceed gravity to climb)
const STRAFE_FORCE    = 16.0;   // was 9 — snappier horizontal   // N horizontal
const YAW_SPEED       =  3.2;   // was 2.2 — tighter turns   // rad/s
const LINEAR_DRAG     =  2.2;   // was 2.8 — less drag = faster   // velocity damping coefficient
const ANGULAR_DRAG    =  5.5;   // was 7.0 — snappier yaw   // yaw damping
const MAX_H_SPEED     = 38;     // was 22 — much faster top speed     // m/s horizontal cap
const MAX_V_SPEED     = 24;     // was 16 — faster climb/dive     // m/s vertical cap
const MAX_TILT        =  0.34;  // radians (~20°) visual tilt limit
const TILT_SPEED      =  6.0;   // how fast the visual tilt catches up
const WIND_MASS       =  4.5;   // was 3.5 — slightly less wind effect at high speed   // effective drone mass for wind (lower = more wind effect)

export class DronePhysics {
  constructor() {
    // Linear state vectors  [x, y, z]
    this.velocity     = [0, 0, 0];
    this.acceleration = [0, 0, 0];

    // Angular state
    this.yaw         = 0;   // current heading (radians)
    this.yawVelocity = 0;   // angular velocity (rad/s)

    // Cosmetic tilt (used in model matrix; no effect on collision or physics)
    this.pitchTilt = 0;
    this.rollTilt  = 0;

    // Pending wind force injected from the outside
    this._pendingWind = null;

    // Boosting flag
    this._boosting = false;
  }

  // External API

  // Called by WeatherSystem each frame before update(). 
  applyWind(force) {
    this._pendingWind = force;
  }

  // Advance the simulation by one frame.
  update(dt, input) {
    // 1. Read control axes 
    const thrustAxis  = input.axis('ArrowDown',  'ArrowUp');    // -1 / 0 / +1
    const forwardAxis = input.axis('KeyS',        'KeyW');
    const strafeAxis  = input.axis('KeyA',        'KeyD');
    const yawAxis     = input.axis('ArrowRight',  'ArrowLeft');

    // 2. Yaw (rotation about Y axis)
    this.yawVelocity += yawAxis * YAW_SPEED * dt;
    this.yawVelocity *= Math.pow(1 - dt * ANGULAR_DRAG, 1);
    this.yaw         += this.yawVelocity * dt;

    // 3. Horizontal forces in world space
    const cosY = Math.cos(this.yaw);
    const sinY = Math.sin(this.yaw);

    // Rotate drone-local forward/strafe into world-space XZ
    const worldFwdX =  cosY * forwardAxis + sinY * strafeAxis;
    const worldFwdZ = -sinY * forwardAxis + cosY * strafeAxis;

    this.acceleration[0] = worldFwdX * STRAFE_FORCE;
    this.acceleration[2] = worldFwdZ * STRAFE_FORCE;

    // 4. Vertical thrust
    // Base thrust exactly cancels gravity → hover at rest
    // Adding thrustAxis pushes above or below hover equilibrium
    this.acceleration[1] = GRAVITY + thrustAxis * THRUST_FORCE - GRAVITY;

    // 5. Wind
    if (this._pendingWind) {
      this.acceleration[0] += this._pendingWind[0] / WIND_MASS;
      this.acceleration[1] += this._pendingWind[1] / WIND_MASS;
      this.acceleration[2] += this._pendingWind[2] / WIND_MASS;
      this._pendingWind = null;
    }

    // 6. Speed boost (Shift key)
    const boosting = input.isDown('ShiftLeft') || input.isDown('ShiftRight');
    if (boosting) {
      // Boost: amplify current horizontal acceleration by 2.4×
      this.acceleration[0] *= 2.4;
      this.acceleration[2] *= 2.4;
    }
    this._boosting = boosting;

    // 6b. Emergency hover
    if (input.isDown('Space')) {
      this.velocity[0] *= 0.85;
      this.velocity[1] *= 0.85;
      this.velocity[2] *= 0.85;
    }

    // 7. Euler integration  v += a * dt
    this.velocity[0] += this.acceleration[0] * dt;
    this.velocity[1] += this.acceleration[1] * dt;
    this.velocity[2] += this.acceleration[2] * dt;

    // 8. Linear drag  v *= (1 - drag * dt)
    const drag = 1 - LINEAR_DRAG * dt;
    this.velocity[0] *= drag;
    this.velocity[1] *= drag * 0.9;  // slightly more vertical damping
    this.velocity[2] *= drag;

    // 9. Speed caps
    const hSpeed = Math.hypot(this.velocity[0], this.velocity[2]);
    if (hSpeed > MAX_H_SPEED) {
      const s = MAX_H_SPEED / hSpeed;
      this.velocity[0] *= s;
      this.velocity[2] *= s;
    }
    this.velocity[1] = Math.max(-MAX_V_SPEED, Math.min(MAX_V_SPEED, this.velocity[1]));

    // 10. Visual tilt (cosmetic)
    // Project world velocity onto drone-local axes to get pitch/roll amounts
    const localFwd   =  cosY * this.velocity[2] - sinY * this.velocity[0];
    const localRight =  sinY * this.velocity[2] + cosY * this.velocity[0];

    const targetPitch = -localFwd   / MAX_H_SPEED * MAX_TILT;
    const targetRoll  =  localRight / MAX_H_SPEED * MAX_TILT;

    const tAlpha = Math.min(TILT_SPEED * dt, 1);
    this.pitchTilt += (targetPitch - this.pitchTilt) * tAlpha;
    this.rollTilt  += (targetRoll  - this.rollTilt)  * tAlpha;

    // Return the position delta and orientation for this frame
    return {
      dx:        this.velocity[0] * dt,
      dy:        this.velocity[1] * dt,
      dz:        this.velocity[2] * dt,
      yaw:       this.yaw,
      pitchTilt: this.pitchTilt,
      rollTilt:  this.rollTilt,
    };
  }

  isBoosting() {
    return this._boosting || false;
  }
}