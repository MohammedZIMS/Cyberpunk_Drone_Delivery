// src/obstacles/FlyingCar.js
import { mat4 } from 'https://cdn.jsdelivr.net/npm/gl-matrix@3.4.3/esm/index.js';

// Evaluate a cubic Bézier at parameter t ∈ [0,1]
// p0..p3 are [x,y,z] arrays
function bezier(p0, p1, p2, p3, t) {
  const u  = 1 - t;
  const u2 = u * u;
  const u3 = u2 * u;
  const t2 = t * t;
  const t3 = t2 * t;
  return [
    u3*p0[0] + 3*u2*t*p1[0] + 3*u*t2*p2[0] + t3*p3[0],
    u3*p0[1] + 3*u2*t*p1[1] + 3*u*t2*p2[1] + t3*p3[1],
    u3*p0[2] + 3*u2*t*p1[2] + 3*u*t2*p2[2] + t3*p3[2],
  ];
}

// Derivative of the Bézier — gives the tangent direction for yaw alignment
function bezierTangent(p0, p1, p2, p3, t) {
  const u  = 1 - t;
  return [
    3*(u*u*(p1[0]-p0[0]) + 2*u*t*(p2[0]-p1[0]) + t*t*(p3[0]-p2[0])),
    3*(u*u*(p1[1]-p0[1]) + 2*u*t*(p2[1]-p1[1]) + t*t*(p3[1]-p2[1])),
    3*(u*u*(p1[2]-p0[2]) + 2*u*t*(p2[2]-p1[2]) + t*t*(p3[2]-p2[2])),
  ];
}

const CAR_COLORS = [
  [1.0, 0.3, 0.1],  // hot orange
  [0.2, 0.8, 1.0],  // electric blue
  [1.0, 0.9, 0.2],  // taxi yellow
  [0.8, 0.2, 1.0],  // neon violet
];

export class FlyingCar {
  // p0..p3: control points for the Bézier path
  constructor(p0, p1, p2, p3, speed = 0.08) {
    this.p0    = p0;
    this.p1    = p1;
    this.p2    = p2;
    this.p3    = p3;
    this.speed = speed;
    this.t     = Math.random(); // start at random position along path

    this.position    = [0, 0, 0];
    this.yaw         = 0;
    this.modelMatrix = mat4.create();
    this.color = CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)];

    // Half-extents for AABB collision (car is a wide flat box)
    this.hw = 1.8;
    this.hh = 0.5;
    this.hd = 3.5;

    this._updatePosition();
  }

  update(dt) {
    // Advance along spline, wrap at 1.0
    this.t = (this.t + this.speed * dt) % 1.0;
    this._updatePosition();
  }

  _updatePosition() {
    const pos = bezier(this.p0, this.p1, this.p2, this.p3, this.t);
    this.position = pos;

    // Align car to face its direction of travel
    const tan = bezierTangent(this.p0, this.p1, this.p2, this.p3, this.t);
    this.yaw = Math.atan2(tan[0], tan[2]);

    mat4.identity(this.modelMatrix);
    mat4.translate(this.modelMatrix, this.modelMatrix, pos);
    mat4.rotateY(this.modelMatrix, this.modelMatrix, this.yaw);
    mat4.scale(this.modelMatrix, this.modelMatrix,
      [this.hw * 2, this.hh * 2, this.hd * 2]);
  }

  draw(gl, program, cubeGeo) {
    gl.bindBuffer(gl.ARRAY_BUFFER, cubeGeo.vbo);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cubeGeo.ibo);

    const stride = cubeGeo.stride;
    const aPos   = gl.getAttribLocation(program, 'aPosition');
    const aNorm  = gl.getAttribLocation(program, 'aNormal');

    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos,  3, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(aNorm);
    gl.vertexAttribPointer(aNorm, 3, gl.FLOAT, false, stride, 12);

    gl.uniformMatrix4fv(
      gl.getUniformLocation(program, 'uModel'), false, this.modelMatrix);
    gl.uniform3fv(
      gl.getUniformLocation(program, 'uObjectColor'), this.color);
    gl.uniform1f(
      gl.getUniformLocation(program, 'uEmissive'), 0.4);

    gl.drawElements(gl.TRIANGLES, cubeGeo.indexCount, gl.UNSIGNED_SHORT, 0);
  }

  // Returns AABB data for collision — world-space, axis-aligned
  // Note: we use the car's world position but axis-aligned half-extents
  // (not rotated) — a small approximation that's fine for fast-moving objects
  getAABB() {
    return {
      cx: this.position[0],
      cy: this.position[1],
      cz: this.position[2],
      hw: this.hw + 0.3,   // small padding
      hh: this.hh + 0.3,
      hd: this.hd + 0.3,
    };
  }
}