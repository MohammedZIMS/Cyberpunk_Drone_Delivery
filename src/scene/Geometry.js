export function createCubeGeometry(gl) {
  // 8 corners of a unit cube (-0.5 to +0.5 on all axes)
  // Each vertex: [x, y, z,  nx, ny, nz]  (position + normal)
  const vertices = new Float32Array([
    // Front face  (normal: 0, 0, +1)
    -0.5, -0.5,  0.5,   0, 0, 1,
     0.5, -0.5,  0.5,   0, 0, 1,
     0.5,  0.5,  0.5,   0, 0, 1,
    -0.5,  0.5,  0.5,   0, 0, 1,
    // Back face   (normal: 0, 0, -1)
    -0.5, -0.5, -0.5,   0, 0,-1,
    -0.5,  0.5, -0.5,   0, 0,-1,
     0.5,  0.5, -0.5,   0, 0,-1,
     0.5, -0.5, -0.5,   0, 0,-1,
    // Top face    (normal: 0, +1, 0)
    -0.5,  0.5, -0.5,   0, 1, 0,
    -0.5,  0.5,  0.5,   0, 1, 0,
     0.5,  0.5,  0.5,   0, 1, 0,
     0.5,  0.5, -0.5,   0, 1, 0,
    // Bottom face (normal: 0, -1, 0)
    -0.5, -0.5, -0.5,   0,-1, 0,
     0.5, -0.5, -0.5,   0,-1, 0,
     0.5, -0.5,  0.5,   0,-1, 0,
    -0.5, -0.5,  0.5,   0,-1, 0,
    // Right face  (normal: +1, 0, 0)
     0.5, -0.5, -0.5,   1, 0, 0,
     0.5,  0.5, -0.5,   1, 0, 0,
     0.5,  0.5,  0.5,   1, 0, 0,
     0.5, -0.5,  0.5,   1, 0, 0,
    // Left face   (normal: -1, 0, 0)
    -0.5, -0.5, -0.5,  -1, 0, 0,
    -0.5, -0.5,  0.5,  -1, 0, 0,
    -0.5,  0.5,  0.5,  -1, 0, 0,
    -0.5,  0.5, -0.5,  -1, 0, 0,
  ]);

  // 2 triangles per face × 6 faces = 12 triangles = 36 indices
  const indices = new Uint16Array([
     0,  1,  2,    0,  2,  3,  // front
     4,  5,  6,    4,  6,  7,  // back
     8,  9, 10,    8, 10, 11,  // top
    12, 13, 14,   12, 14, 15,  // bottom
    16, 17, 18,   16, 18, 19,  // right
    20, 21, 22,   20, 22, 23,  // left
  ]);

  // Upload to GPU
  const vbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

  const ibo = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);

  return {
    vbo,
    ibo,
    indexCount: indices.length,
    // stride: 6 floats per vertex (3 pos + 3 normal) × 4 bytes
    stride: 6 * 4,
  };
}