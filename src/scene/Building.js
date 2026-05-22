// src/scene/Building.js
import { mat4 } from 'https://cdn.jsdelivr.net/npm/gl-matrix@3.4.3/esm/index.js';

export class Building {
  constructor(x, z, width, height, depth) {
    this.x      = x;
    this.z      = z;
    this.width  = width;
    this.height = height;
    this.depth  = depth;

    // Neon color per building (cycled from a cyberpunk palette)
    const palette = [
      [0.0, 1.0, 0.8],   // cyan
      [1.0, 0.0, 0.6],   // magenta
      [0.4, 0.0, 1.0],   // purple
      [1.0, 0.5, 0.0],   // amber
      [0.0, 0.9, 1.0],   //  blue
    ];
    this.color = palette[Math.floor(Math.random() * palette.length)];
    this.modelMatrix = mat4.create();
    this._buildMatrix();
  }


  _buildMatrix() {
    mat4.identity(this.modelMatrix);
    // Place the building so its base sits on y=0
    mat4.translate(this.modelMatrix, this.modelMatrix,
      [this.x, this.height / 2, this.z]);
    mat4.scale(this.modelMatrix, this.modelMatrix,
      [this.width, this.height, this.depth]);
  }

  draw(gl, program, cubeGeometry) {
    // Bind geometry buffers
    gl.bindBuffer(gl.ARRAY_BUFFER, cubeGeometry.vbo);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cubeGeometry.ibo);

    // Tell WebGL where position and normal data live inside the buffer
    const aPos    = gl.getAttribLocation(program, 'aPosition');
    const aNorm   = gl.getAttribLocation(program, 'aNormal');
    const stride  = cubeGeometry.stride;

    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos,  3, gl.FLOAT, false, stride, 0);      // 3 floats at offset 0

    gl.enableVertexAttribArray(aNorm);
    gl.vertexAttribPointer(aNorm, 3, gl.FLOAT, false, stride, 3 * 4);  // 3 floats at offset 12 bytes

    // Upload model matrix + color
    gl.uniformMatrix4fv(
      gl.getUniformLocation(program, 'uModel'), false, this.modelMatrix);
    gl.uniform3fv(
      gl.getUniformLocation(program, 'uObjectColor'), this.color);

    gl.drawElements(gl.TRIANGLES, cubeGeometry.indexCount, gl.UNSIGNED_SHORT, 0);
  }
}