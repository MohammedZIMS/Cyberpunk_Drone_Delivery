// src/weather/FogVolume.js

export class FogVolume {
  constructor() {
    this._density     = 0.002;   // current (smoothed) density
    this._targetDensity = 0.002;
    this._fogColor    = [0.03, 0.02, 0.08]; // deep purple night fog
  }

  update(dt, targetDensity) {
  const safeTarget = Math.max(0.0001, Math.min(targetDensity, 0.01));
  this._density += (safeTarget - this._density) * dt * 0.4;
}

  // Upload fog uniforms to the scene shader
  upload(gl, program) {
    gl.uniform1f(
      gl.getUniformLocation(program, 'uFogDensity'), this._density);
    gl.uniform3fv(
      gl.getUniformLocation(program, 'uFogColor'),   this._fogColor);
  }

  setColor(r, g, b) { this._fogColor = [r, g, b]; }
}