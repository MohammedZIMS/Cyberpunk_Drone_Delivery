import { mat4 } from 'https://cdn.jsdelivr.net/npm/gl-matrix@3.4.3/esm/index.js';

const BILLBOARD_COLORS = [
  [0.0, 1.0, 0.8],  // cyan ad
  [1.0, 0.2, 0.6],  // pink ad
  [0.3, 0.5, 1.0],  // blue ad
  [1.0, 0.7, 0.0],  // amber ad
];

export class Billboard {
  // pos: world-space center; normal: which direction it faces; w/h: dimensions
  constructor(pos, normalYaw, w = 6, h = 3) {
    this.position  = pos;
    this.normalYaw = normalYaw;
    this.w = w;
    this.h = h;
    this.depth = 0.3;
    this.color = BILLBOARD_COLORS[
      Math.floor(Math.random() * BILLBOARD_COLORS.length)];

    // Animate: slow brightness pulse
    this._phase = Math.random() * Math.PI * 2;

    this.modelMatrix = mat4.create();
    mat4.translate(this.modelMatrix, this.modelMatrix, pos);
    mat4.rotateY(this.modelMatrix, this.modelMatrix, normalYaw);
    mat4.scale(this.modelMatrix, this.modelMatrix, [w, h, this.depth]);
  }

  update(dt) {
    this._phase += dt * 1.5;
  }

  draw(gl, program, cubeGeo) {
    // Pulse emissive brightness between 1.5 and 3.0
    const emissive = 2.0 + Math.sin(this._phase) * 0.8;

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
      gl.getUniformLocation(program, 'uEmissive'), emissive);

    gl.drawElements(gl.TRIANGLES, cubeGeo.indexCount, gl.UNSIGNED_SHORT, 0);
  }

  // Axis-aligned AABB (approximation — ignores yaw rotation)
  getAABB() {
    return {
      cx: this.position[0],
      cy: this.position[1],
      cz: this.position[2],
      hw: this.w / 2 + 0.2,
      hh: this.h / 2 + 0.2,
      hd: this.depth / 2 + 0.2,
    };
  }
}