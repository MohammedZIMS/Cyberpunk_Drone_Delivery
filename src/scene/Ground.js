// src/scene/Ground.js

import { mat4 } from 'https://cdn.jsdelivr.net/npm/gl-matrix@3.4.3/esm/index.js';

export class Ground {
  constructor(size = 2000) {
    this.size = size;

    // Dark cyberpunk asphalt color
    this.color = [0.02, 0.02, 0.025];

    this.modelMatrix = mat4.create();

    mat4.identity(this.modelMatrix);

    // Slightly below y=0 to avoid z-fighting
    mat4.translate(
      this.modelMatrix,
      this.modelMatrix,
      [0, -0.1, 0]
    );

    mat4.scale(
      this.modelMatrix,
      this.modelMatrix,
      [size, 0.1, size]
    );
  }

  draw(gl, program, cubeGeometry) {
    gl.bindBuffer(gl.ARRAY_BUFFER, cubeGeometry.vbo);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cubeGeometry.ibo);

    const stride = cubeGeometry.stride;

    const aPos =
      gl.getAttribLocation(program, 'aPosition');

    const aNorm =
      gl.getAttribLocation(program, 'aNormal');

    gl.enableVertexAttribArray(aPos);

    gl.vertexAttribPointer(
      aPos,
      3,
      gl.FLOAT,
      false,
      stride,
      0
    );

    gl.enableVertexAttribArray(aNorm);

    gl.vertexAttribPointer(
      aNorm,
      3,
      gl.FLOAT,
      false,
      stride,
      12
    );

    gl.uniformMatrix4fv(
      gl.getUniformLocation(program, 'uModel'),
      false,
      this.modelMatrix
    );

    gl.uniform3fv(
      gl.getUniformLocation(program, 'uObjectColor'),
      this.color
    );

    gl.uniform1f(
      gl.getUniformLocation(program, 'uEmissive'),
      0.0
    );

    gl.drawElements(
      gl.TRIANGLES,
      cubeGeometry.indexCount,
      gl.UNSIGNED_SHORT,
      0
    );
  }
}