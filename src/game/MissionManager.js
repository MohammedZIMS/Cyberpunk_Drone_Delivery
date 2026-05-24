import { MissionTimer } from '../systems/MissionTimer.js';
import { mat4 } from 'https://cdn.jsdelivr.net/npm/gl-matrix@3.4.3/esm/index.js';

const PICKUP_RADIUS  = 5.0;   // metres — how close to trigger pickup
const DROPOFF_RADIUS = 6.0;
const ZONE_HEIGHT    = 1.0;   // thin disc rendered as flat cube

const ZONE_COLORS = {
  pickup:  [0.0, 1.0, 0.4],  // green
  dropoff: [1.0, 0.6, 0.0],  // orange
  done:    [0.0, 0.6, 1.0],  // blue flash on completion
};

export class MissionManager {
  constructor(buildings) {
    this.buildings    = buildings.filter(b => b.height > 20);
    this.state        = 'idle';   // idle | pickup | transit | dropoff
    this.pickupPos    = null;
    this.dropoffPos   = null;
    this.missionTimer = 0;
    this.timeLimit    = 120;      // now managed by MissionTimer
    this._flashTimer  = 0;
    this._missionTimerSys = new MissionTimer();
    this._onDeliver   = null;     // callback(timeRemaining, weatherState)
    this._onFail      = null;
    this._onPickup    = null;     // callback() — fires once per pickup
    this._pickupSuccess = false;  // guard: prevents duplicate pickup reward

    // Pulsing animation phase
    this._phase = 0;

    this._spawnMission();
  }

  onDeliver(fn)  { this._onDeliver  = fn; }
  onFail(fn)     { this._onFail     = fn; }
  onSpawn(fn)    { this._onSpawn    = fn; }
  onPickup(fn)   { this._onPickup   = fn; }

  // Spawn

  _spawnMission() {
    const picks = this._randomPair();
    this.pickupPos  = [picks[0].x, picks[0].height + 0.5, picks[0].z];
    this.dropoffPos = [picks[1].x, picks[1].height + 0.5, picks[1].z];
    this.state        = 'pickup';
    this.missionTimer = 0;
    this._pickupSuccess = false;  // reset pickup reward guard for new mission
    // Use MissionTimer for distance-scaled time limit
    this._missionTimerSys.startMission(this.pickupPos, this.dropoffPos);
    this.timeLimit = this._missionTimerSys.getLimit();
    if (this._onSpawn) this._onSpawn(this.pickupPos, this.dropoffPos);
  }

  _randomPair() {
    const shuffled = [...this.buildings].sort(() => Math.random() - 0.5);
    // Ensure pickup and dropoff are at least 80 units apart
    for (let i = 0; i < shuffled.length; i++) {
      for (let j = i + 1; j < shuffled.length; j++) {
        const dx = shuffled[i].x - shuffled[j].x;
        const dz = shuffled[i].z - shuffled[j].z;
        if (Math.sqrt(dx*dx + dz*dz) > 80) return [shuffled[i], shuffled[j]];
      }
    }
    return [shuffled[0], shuffled[1]];
  }

  // Per-frame

  update(dt, dronePos, droneVel, weatherState) {
    this._phase      += dt * 2.5;
    this._flashTimer  = Math.max(0, this._flashTimer - dt);

    if (this.state === 'idle') return;

    this._missionTimerSys.update(dt);
    this.missionTimer = this._missionTimerSys.getElapsed();

    // Time limit exceeded
    if (!this._missionTimerSys.isRunning() && this.missionTimer > 0) {
      if (this._onFail) this._onFail('timeout');
      this._spawnMission();
      return;
    }

    const dist = (pos) => {
      const dx = dronePos[0] - pos[0];
      const dy = dronePos[1] - pos[1];
      const dz = dronePos[2] - pos[2];
      return Math.sqrt(dx*dx + dy*dy + dz*dz);
    };

    if (this.state === 'pickup' && dist(this.pickupPos) < PICKUP_RADIUS) {
      this.state       = 'transit';
      this._flashTimer = 0.8;
      // Fire pickup reward exactly once per package
      if (!this._pickupSuccess) {
        this._pickupSuccess = true;
        if (this._onPickup) this._onPickup(this.pickupPos);
      }
    }

    if (this.state === 'transit' && dist(this.dropoffPos) < DROPOFF_RADIUS) {
      this.state       = 'done';
      this._flashTimer = 1.5;
      this._missionTimerSys.stop();
      const timeLeft   = this._missionTimerSys.getRemaining();
      const approachSpeed = Math.hypot(droneVel[0]||0, droneVel[1]||0, droneVel[2]||0);
      if (this._onDeliver) this._onDeliver(timeLeft, this.timeLimit, approachSpeed, weatherState);
      setTimeout(() => this._spawnMission(), 1800);
    }
  }

  // Draw

  draw(gl, program, cubeGeo) {
    const pulse = 0.7 + Math.sin(this._phase) * 0.3;

    if (this.state === 'pickup' || this.state === 'idle') {
      this._drawZone(gl, program, cubeGeo, this.pickupPos,
        ZONE_COLORS.pickup, pulse);
    }
    if (this.state === 'transit') {
      this._drawZone(gl, program, cubeGeo, this.pickupPos,
        [0.2, 0.2, 0.2], 0.3);   // dim — already collected
      this._drawZone(gl, program, cubeGeo, this.dropoffPos,
        ZONE_COLORS.dropoff, pulse);
    }
    if (this.state === 'done') {
      const f = this._flashTimer / 1.5;
      this._drawZone(gl, program, cubeGeo, this.dropoffPos,
        ZONE_COLORS.done, f);
    }
  }

  _drawZone(gl, program, cubeGeo, pos, color, emissive) {
    if (!pos) return;

    const model = mat4.create();
    mat4.translate(model, model, pos);
    mat4.scale(model, model, [8, ZONE_HEIGHT, 8]);

    gl.bindBuffer(gl.ARRAY_BUFFER, cubeGeo.vbo);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cubeGeo.ibo);
    const stride = cubeGeo.stride;
    const aPos   = gl.getAttribLocation(program, 'aPosition');
    const aNorm  = gl.getAttribLocation(program, 'aNormal');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos,  3, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(aNorm);
    gl.vertexAttribPointer(aNorm, 3, gl.FLOAT, false, stride, 12);

    gl.uniformMatrix4fv(gl.getUniformLocation(program, 'uModel'), false, model);
    gl.uniform3fv(gl.getUniformLocation(program, 'uObjectColor'), color);
    gl.uniform1f(gl.getUniformLocation(program, 'uEmissive'), emissive * 2.5);
    gl.drawElements(gl.TRIANGLES, cubeGeo.indexCount, gl.UNSIGNED_SHORT, 0);
  }

  // Accessors for HUD
  getState()        { return this.state; }
  getTimeRemaining(){ return this._missionTimerSys.getRemaining(); }
  getTimeFraction() { return this._missionTimerSys.getFraction(); }
  getWarningLevel() { return this._missionTimerSys.getWarningLevel(); }
  getPickupPos()    { return this.pickupPos; }
  getDropoffPos()   { return this.dropoffPos; }
}