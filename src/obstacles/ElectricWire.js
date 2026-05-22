import { mat4 } from 'https://cdn.jsdelivr.net/npm/gl-matrix@3.4.3/esm/index.js';

export class ElectricWire {
  // a, b: [x,y,z] endpoints; radius: collision thickness
  constructor(a, b, radius = 0.4) {
    this.a      = a;
    this.b      = b;
    this.radius = radius;

    // Visual sag: control point pulled down 20% of segment height
    const midY = (a[1] + b[1]) / 2 - Math.abs(b[0] - a[0]) * 0.08;
    this.mid = [(a[0]+b[0])/2, midY, (a[2]+b[2])/2];

    // Precompute segment vector for collision
    this.ab = [b[0]-a[0], b[1]-a[1], b[2]-a[2]];
    this.lenSq = this.ab[0]**2 + this.ab[1]**2 + this.ab[2]**2;

    // Emissive color: pale blue-white like a live wire
    this.color = [0.7, 0.9, 1.0];

    // Spark FX state
    this._sparkTimer = 0;
    this._sparking   = false;

    this._buildSegments();
  }

  // Approximate the catenary with 8 straight segments for rendering
  _buildSegments() {
    this.segments = [];
    const N = 8;
    let prev = this.a;
    for (let i = 1; i <= N; i++) {
      const t  = i / N;
      const u  = 1 - t;
      // Quadratic Bézier: a → mid → b
      const pt = [
        u*u*this.a[0] + 2*u*t*this.mid[0] + t*t*this.b[0],
        u*u*this.a[1] + 2*u*t*this.mid[1] + t*t*this.b[1],
        u*u*this.a[2] + 2*u*t*this.mid[2] + t*t*this.b[2],
      ];
      this.segments.push({ from: prev, to: pt });
      prev = pt;
    }
  }

  update(dt) {
    // Tick down spark timer
    if (this._sparking) {
      this._sparkTimer -= dt;
      if (this._sparkTimer <= 0) this._sparking = false;
    }
  }

  // Called by CollisionDetector when drone hits this wire
  triggerSpark() {
    this._sparking   = true;
    this._sparkTimer = 0.25; // spark lasts 250ms
  }

  // Draw wire as thin elongated cubes along each segment
  draw(gl, program, cubeGeo) {
    const emissive = this._sparking ? 3.0 : 0.6;
    const color    = this._sparking ? [1.0, 0.8, 0.2] : this.color;

    gl.uniform3fv(gl.getUniformLocation(program, 'uObjectColor'), color);
    gl.uniform1f (gl.getUniformLocation(program, 'uEmissive'),    emissive);

    for (const seg of this.segments) {
      this._drawSegment(gl, program, cubeGeo, seg.from, seg.to);
    }
  }

  _drawSegment(gl, program, cubeGeo, from, to) {
    const dx = to[0] - from[0];
    const dy = to[1] - from[1];
    const dz = to[2] - from[2];
    const len = Math.sqrt(dx*dx + dy*dy + dz*dz);
    if (len < 0.001) return;

    const cx = (from[0] + to[0]) / 2;
    const cy = (from[1] + to[1]) / 2;
    const cz = (from[2] + to[2]) / 2;

    const model = mat4.create();
    mat4.translate(model, model, [cx, cy, cz]);

    // Rotate unit Z to point along the segment direction
    const yaw   = Math.atan2(dx, dz);
    const pitch = -Math.asin(dy / len);
    mat4.rotateY(model, model, yaw);
    mat4.rotateX(model, model, pitch);
    mat4.scale(model, model, [this.radius * 2, this.radius * 2, len]);

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
      gl.getUniformLocation(program, 'uModel'), false, model);

    gl.drawElements(gl.TRIANGLES, cubeGeo.indexCount, gl.UNSIGNED_SHORT, 0);
  }

  // Closest point on segment AB to point P — used by collision
  closestPointOnSegment(p) {
    const ap = [p[0]-this.a[0], p[1]-this.a[1], p[2]-this.a[2]];
    let t = (ap[0]*this.ab[0] + ap[1]*this.ab[1] + ap[2]*this.ab[2]) / this.lenSq;
    t = Math.max(0, Math.min(1, t));
    return [
      this.a[0] + t * this.ab[0],
      this.a[1] + t * this.ab[1],
      this.a[2] + t * this.ab[2],
    ];
  }

  // Squared distance from drone center to nearest point on wire
  distSqToPoint(p) {
    const cp = this.closestPointOnSegment(p);
    return (p[0]-cp[0])**2 + (p[1]-cp[1])**2 + (p[2]-cp[2])**2;
  }
}