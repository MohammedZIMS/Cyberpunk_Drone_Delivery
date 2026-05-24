import { mat4, vec3 } from 'https://cdn.jsdelivr.net/npm/gl-matrix@3.4.3/esm/index.js';
import { DronePhysics } from './DronePhysics.js';

const GROUND_LEVEL = 2.0;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Multiply a scratch mat4 through a chain of transforms then draw. */
function drawPart(gl, program, cubeGeo, baseMatrix, localFn, color) {
  const m = mat4.clone(baseMatrix);
  localFn(m);
  gl.uniformMatrix4fv(gl.getUniformLocation(program, 'uModel'), false, m);
  gl.uniform3fv(gl.getUniformLocation(program, 'uObjectColor'), color);
  gl.drawElements(gl.TRIANGLES, cubeGeo.indexCount, gl.UNSIGNED_SHORT, 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// Drone
// ─────────────────────────────────────────────────────────────────────────────

export class Drone {
  constructor() {
    this.position    = [0, 15, 0];
    this.physics     = new DronePhysics();
    this.modelMatrix = mat4.create();   // root transform (body centre)

    // Rotor animation
    this._rotorAngle = 0;       // radians, accumulates every frame
    this._rotorSpeed = 18.0;    // rad/s at idle
    this._bobPhase   = 0;       // subtle hover bob

    // Last-frame tilt values (smoothed for visual comfort)
    this._smoothPitch = 0;
    this._smoothRoll  = 0;

    // Landing-light pulse
    this._lightPhase = 0;
  }

  // ── Public update ──────────────────────────────────────────────────────────
  update(dt, input) {
    const delta = this.physics.update(dt, input, this.physics.yaw);

    this.position[0] += delta.dx;
    this.position[1] += delta.dy;
    this.position[2] += delta.dz;
    this.position[1]  = Math.max(GROUND_LEVEL, this.position[1]);

    // Rotor spins faster when boosting / at high speed
    const speed = Math.hypot(delta.dx, delta.dz) / (dt || 0.016);
    this._rotorSpeed = 14 + Math.min(speed * 0.8, 22);
    this._rotorAngle += this._rotorSpeed * dt;

    // Hover bob (tiny vertical oscillation)
    this._bobPhase += dt * 1.4;
    const bob = Math.sin(this._bobPhase) * 0.04;

    // Smooth tilt so the model doesn't snap
    const TILT_SMOOTH = 8;
    this._smoothPitch += (delta.pitchTilt - this._smoothPitch) * Math.min(1, TILT_SMOOTH * dt);
    this._smoothRoll  += (delta.rollTilt  - this._smoothRoll)  * Math.min(1, TILT_SMOOTH * dt);

    // Light pulse
    this._lightPhase += dt * 3.5;

    // Build root matrix (world position + yaw + tilt)
    mat4.identity(this.modelMatrix);
    mat4.translate(this.modelMatrix, this.modelMatrix,
      [this.position[0], this.position[1] + bob, this.position[2]]);
    mat4.rotateY(this.modelMatrix, this.modelMatrix, delta.yaw);
    mat4.rotateX(this.modelMatrix, this.modelMatrix, this._smoothPitch);
    mat4.rotateZ(this.modelMatrix, this.modelMatrix, this._smoothRoll);
  }

  // ── Draw (multi-part) ──────────────────────────────────────────────────────
  draw(gl, program, cubeGeo) {
    // Bind geometry once
    gl.bindBuffer(gl.ARRAY_BUFFER, cubeGeo.vbo);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cubeGeo.ibo);

    const stride = cubeGeo.stride;
    const aPos   = gl.getAttribLocation(program, 'aPosition');
    const aNorm  = gl.getAttribLocation(program, 'aNormal');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos,  3, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(aNorm);
    gl.vertexAttribPointer(aNorm, 3, gl.FLOAT, false, stride, 12);

    const base   = this.modelMatrix;
    const rAngle = this._rotorAngle;

    // ── 1. Central body (flattened box) ──────────────────────────────────
    drawPart(gl, program, cubeGeo, base,
      m => mat4.scale(m, m, [1.4, 0.35, 1.4]),
      [0.12, 0.14, 0.18]   // dark charcoal
    );

    // ── 2. Top dome / sensor pod ──────────────────────────────────────────
    drawPart(gl, program, cubeGeo, base,
      m => {
        mat4.translate(m, m, [0, 0.28, 0]);
        mat4.scale(m, m, [0.55, 0.22, 0.55]);
      },
      [0.18, 0.20, 0.26]   // slightly lighter
    );

    // ── 3. Battery / payload bay (underside) ─────────────────────────────
    drawPart(gl, program, cubeGeo, base,
      m => {
        mat4.translate(m, m, [0, -0.28, 0]);
        mat4.scale(m, m, [0.9, 0.18, 0.55]);
      },
      [0.08, 0.09, 0.14]
    );

    // ── 4. Four arms (diagonal cross) ────────────────────────────────────
    const armOffsets = [
      [ 0.78,  0.78],   // front-right  (+X, +Z)
      [-0.78,  0.78],   // front-left
      [-0.78, -0.78],   // rear-left
      [ 0.78, -0.78],   // rear-right
    ];
    const armAngles = [Math.PI / 4, -Math.PI / 4, Math.PI / 4, -Math.PI / 4];

    for (let i = 0; i < 4; i++) {
      const [ax, az] = armOffsets[i];

      // Arm tube
      drawPart(gl, program, cubeGeo, base,
        m => {
          mat4.translate(m, m, [ax * 0.5, 0, az * 0.5]);
          mat4.rotateY(m, m, armAngles[i]);
          mat4.scale(m, m, [1.10, 0.13, 0.22]);
        },
        [0.20, 0.22, 0.28]
      );

      // Motor nacelle
      drawPart(gl, program, cubeGeo, base,
        m => {
          mat4.translate(m, m, [ax, 0.05, az]);
          mat4.scale(m, m, [0.28, 0.20, 0.28]);
        },
        [0.30, 0.32, 0.38]
      );

      // ── Rotor disc (spinning flat slab) ────────────────────────────────
      // Even rotors spin CW, odd rotors spin CCW (realistic counter-rotation)
      const spin = i % 2 === 0 ? rAngle : -rAngle;
      drawPart(gl, program, cubeGeo, base,
        m => {
          mat4.translate(m, m, [ax, 0.18, az]);
          mat4.rotateY(m, m, spin);
          mat4.scale(m, m, [0.70, 0.04, 0.14]);   // long thin blade slab
        },
        [0.55, 0.60, 0.70]
      );
      // Second blade (perpendicular — gives 2-blade illusion)
      drawPart(gl, program, cubeGeo, base,
        m => {
          mat4.translate(m, m, [ax, 0.18, az]);
          mat4.rotateY(m, m, spin + Math.PI / 2);
          mat4.scale(m, m, [0.70, 0.04, 0.14]);
        },
        [0.55, 0.60, 0.70]
      );
    }

    // ── 5. LED navigation lights ──────────────────────────────────────────
    // Front (red), Rear (green), sides pulse cyan — classic aviation lights
    const pulse = 0.6 + 0.4 * Math.sin(this._lightPhase);

    // Front-right LED
    drawPart(gl, program, cubeGeo, base,
      m => {
        mat4.translate(m, m, [0.78, 0.12, 0.78]);
        mat4.scale(m, m, [0.12, 0.12, 0.12]);
      },
      [1.0, 0.15 * pulse, 0.15 * pulse]   // red
    );
    // Front-left LED
    drawPart(gl, program, cubeGeo, base,
      m => {
        mat4.translate(m, m, [-0.78, 0.12, 0.78]);
        mat4.scale(m, m, [0.12, 0.12, 0.12]);
      },
      [1.0, 0.15 * pulse, 0.15 * pulse]   // red
    );
    // Rear-right LED
    drawPart(gl, program, cubeGeo, base,
      m => {
        mat4.translate(m, m, [0.78, 0.12, -0.78]);
        mat4.scale(m, m, [0.12, 0.12, 0.12]);
      },
      [0.15 * pulse, 1.0, 0.30 * pulse]   // green
    );
    // Rear-left LED
    drawPart(gl, program, cubeGeo, base,
      m => {
        mat4.translate(m, m, [-0.78, 0.12, -0.78]);
        mat4.scale(m, m, [0.12, 0.12, 0.12]);
      },
      [0.15 * pulse, 1.0, 0.30 * pulse]   // green
    );

    // ── 6. Undercarriage / landing skids ──────────────────────────────────
    // Two fore-aft rails, two cross-struts
    const skidColor = [0.15, 0.15, 0.20];

    // Left rail
    drawPart(gl, program, cubeGeo, base,
      m => {
        mat4.translate(m, m, [-0.65, -0.38, 0]);
        mat4.scale(m, m, [0.10, 0.10, 1.60]);
      },
      skidColor
    );
    // Right rail
    drawPart(gl, program, cubeGeo, base,
      m => {
        mat4.translate(m, m, [0.65, -0.38, 0]);
        mat4.scale(m, m, [0.10, 0.10, 1.60]);
      },
      skidColor
    );
    // Front strut
    drawPart(gl, program, cubeGeo, base,
      m => {
        mat4.translate(m, m, [0, -0.20, 0.70]);
        mat4.scale(m, m, [1.40, 0.12, 0.10]);
      },
      skidColor
    );
    // Rear strut
    drawPart(gl, program, cubeGeo, base,
      m => {
        mat4.translate(m, m, [0, -0.20, -0.70]);
        mat4.scale(m, m, [1.40, 0.12, 0.10]);
      },
      skidColor
    );
  }

  // ── Accessors ──────────────────────────────────────────────────────────────
  getPosition() { return this.position; }
  getVelocity() { return this.physics.velocity; }
  getYaw()      { return this.physics.yaw; }
}