import { mat4 } from 'https://cdn.jsdelivr.net/npm/gl-matrix@3.4.3/esm/index.js';

export class RoadGrid {
  constructor(size = 3000, cellSize = 20) {
    this.size = size;
    this.cellSize = cellSize;

    this.color = [0.0, 0.9, 1.0]; // neon cyan

    this.modelMatrix = mat4.create();

    mat4.identity(this.modelMatrix);

    // Slightly above ground to avoid z-fighting
    mat4.translate(this.modelMatrix, this.modelMatrix, [
      0,
      -0.08,
      0
    ]);

    mat4.scale(this.modelMatrix, this.modelMatrix, [
      size,
      1,
      size
    ]);

    this.time = 0;
  }

  update(dt) {
    this.time += dt;
  }

  draw(gl, program, cubeGeometry) {

    gl.bindBuffer(gl.ARRAY_BUFFER, cubeGeometry.vbo);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cubeGeometry.ibo);

    const aPos = gl.getAttribLocation(program, 'aPosition');
    const aNorm = gl.getAttribLocation(program, 'aNormal');
    const stride = cubeGeometry.stride;

    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, stride, 0);

    gl.enableVertexAttribArray(aNorm);
    gl.vertexAttribPointer(aNorm, 3, gl.FLOAT, false, stride, 12);

    // Model
    gl.uniformMatrix4fv(
      gl.getUniformLocation(program, 'uModel'),
      false,
      this.modelMatrix
    );

    // Color (neon base)
    const pulse =
      0.6 + Math.sin(this.time * 2.5) * 0.2;

    gl.uniform3fv(
      gl.getUniformLocation(program, 'uObjectColor'),
      [
        this.color[0] * pulse,
        this.color[1] * pulse,
        this.color[2] * pulse
      ]
    );

    // Make it glow stronger than buildings
    gl.uniform1f(
      gl.getUniformLocation(program, 'uEmissive'),
      1.2
    );

    gl.drawElements(
      gl.TRIANGLES,
      cubeGeometry.indexCount,
      gl.UNSIGNED_SHORT,
      0
    );
  }
}