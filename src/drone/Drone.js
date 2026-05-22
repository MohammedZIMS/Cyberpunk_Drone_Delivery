import { mat4 } from 'https://cdn.jsdelivr.net/npm/gl-matrix@3.4.3/esm/index.js';
import { DronePhysics } from './DronePhysics.js';

const GROUND_LEVEL = 2.0; // minimum altitude — can't fly underground

export class Drone {
  constructor() {
    this.position = [0, 15, 0];
    this.physics  = new DronePhysics();
    this.modelMatrix = mat4.create();
  }

  update(dt, input) {
    const delta = this.physics.update(dt, input, this.physics.yaw);

    // Apply position delta
    this.position[0] += delta.dx;
    this.position[1] += delta.dy;
    this.position[2] += delta.dz;

    // Clamp to ground
    this.position[1] = Math.max(GROUND_LEVEL, this.position[1]);

    // Build model matrix with yaw + visual tilt
    mat4.identity(this.modelMatrix);
    mat4.translate(this.modelMatrix, this.modelMatrix, this.position);
    mat4.rotateY(this.modelMatrix, this.modelMatrix, delta.yaw);
    mat4.rotateX(this.modelMatrix, this.modelMatrix, delta.pitchTilt);
    mat4.rotateZ(this.modelMatrix, this.modelMatrix, delta.rollTilt);
    mat4.scale(this.modelMatrix, this.modelMatrix, [2.5, 0.4, 2.5]);
  }

  draw(gl, program, cubeGeometry) {
    gl.bindBuffer(gl.ARRAY_BUFFER, cubeGeometry.vbo);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cubeGeometry.ibo);

    const stride = cubeGeometry.stride;
    const aPos   = gl.getAttribLocation(program, 'aPosition');
    const aNorm  = gl.getAttribLocation(program, 'aNormal');

    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos,  3, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(aNorm);
    gl.vertexAttribPointer(aNorm, 3, gl.FLOAT, false, stride, 12);

    gl.uniformMatrix4fv(
      gl.getUniformLocation(program, 'uModel'), false, this.modelMatrix);
    gl.uniform3fv(
      gl.getUniformLocation(program, 'uObjectColor'), [0.9, 0.9, 1.0]);

    gl.drawElements(gl.TRIANGLES, cubeGeometry.indexCount, gl.UNSIGNED_SHORT, 0);
  }

  // Expose position for camera, HUD, collision
  getPosition() { return this.position; }
  getVelocity() { return this.physics.velocity; }
  getYaw()      { return this.physics.yaw; }
}