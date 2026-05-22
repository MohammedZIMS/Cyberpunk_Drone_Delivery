import { mat4 } from 'https://cdn.jsdelivr.net/npm/gl-matrix@3.4.3/esm/index.js';

const STATES = {
  WAITING: 'waiting',
  COLLECTED: 'collected',
  DELIVERED: 'delivered'
};

const HOVER_RADIUS = 4.0;
const HOVER_TIME   = 0.8;
const MAX_SPEED    = 3.0; // m/s horizontal limit for landing

export class DeliveryTarget {
  constructor(building) {
    this.building = building;

    this.position = [
      building.x,
      building.height + 1.5,
      building.z
    ];

    this.size = 2.0;
    this.state = STATES.WAITING;

    this.modelMatrix = mat4.create();

    this.color = Math.random() > 0.5
      ? [1.0, 0.6, 0.0]   // amber
      : [0.0, 1.0, 0.8];  // cyan

    this._pulse = Math.random() * Math.PI * 2;

    // hover system 
    this._hoverTimer = 0;
    this._isHovering  = false;
  }

  // SIMPLE DIST (same style as MissionManager)
  dist(a, b) {
    const dx = a[0] - b[0];
    const dy = a[1] - b[1];
    const dz = a[2] - b[2];
    return Math.sqrt(dx*dx + dy*dy + dz*dz);
  }

  // GAME LOGIC
  update(dt, dronePos, droneVel) {
    this._pulse += dt * 3.0;

    if (this.state !== STATES.WAITING) return false;

    const horizontalSpeed = Math.hypot(droneVel[0], droneVel[2]);
    const distance = this.dist(dronePos, this.position);

    const inRange = distance < HOVER_RADIUS;
    const slowEnough = horizontalSpeed < MAX_SPEED;
    const heightClose = Math.abs(dronePos[1] - this.position[1]) < 2.5;

    // ── Hover detection condition ─────────────────────────────
    if (inRange && slowEnough && heightClose) {
      this._hoverTimer += dt;
      this._isHovering = true;

      // success after holding hover
      if (this._hoverTimer >= HOVER_TIME) {
        this.collect();
        return true; // collected
      }
    } else {
      this._hoverTimer = 0;
      this._isHovering = false;
    }

    return false;
  }

  // STATE CHANGES

  collect() {
    this.state = STATES.COLLECTED;
    this._hoverTimer = 0;
    this._isHovering = false;
  }

  deliver() {
    if (this.state === STATES.COLLECTED) {
      this.state = STATES.DELIVERED;
    }
  }

  reset() {
    this.state = STATES.WAITING;
    this._hoverTimer = 0;
  }

  // RENDER

  draw(gl, program, cubeGeo) {
    if (this.state === STATES.DELIVERED) return;

    const pulse = 0.6 + Math.sin(this._pulse) * 0.4;

    mat4.identity(this.modelMatrix);
    mat4.translate(this.modelMatrix, this.modelMatrix, this.position);
    mat4.scale(this.modelMatrix, this.modelMatrix, [
      this.size,
      this.size,
      this.size
    ]);

    gl.bindBuffer(gl.ARRAY_BUFFER, cubeGeo.vbo);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cubeGeo.ibo);

    const aPos  = gl.getAttribLocation(program, 'aPosition');
    const aNorm = gl.getAttribLocation(program, 'aNormal');
    const stride = cubeGeo.stride;

    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, stride, 0);

    gl.enableVertexAttribArray(aNorm);
    gl.vertexAttribPointer(aNorm, 3, gl.FLOAT, false, stride, 12);

    gl.uniformMatrix4fv(
      gl.getUniformLocation(program, 'uModel'),
      false,
      this.modelMatrix
    );

    gl.uniform3fv(
      gl.getUniformLocation(program, 'uObjectColor'),
      this.color
    );

    // glow gets stronger when hovering
    const emissive =
      this.state === STATES.WAITING
        ? (this._isHovering ? 4.0 * pulse : 2.5 * pulse)
        : 0.0;

    gl.uniform1f(
      gl.getUniformLocation(program, 'uEmissive'),
      emissive
    );

    gl.drawElements(
      gl.TRIANGLES,
      cubeGeo.indexCount,
      gl.UNSIGNED_SHORT,
      0
    );
  }

  // HUD HELPERS

  getHoverProgress() {
    return Math.min(this._hoverTimer / HOVER_TIME, 1.0);
  }

  isHovering() {
    return this._isHovering;
  }

  getPosition() {
    return this.position;
  }

  getState() {
    return this.state;
  }
}