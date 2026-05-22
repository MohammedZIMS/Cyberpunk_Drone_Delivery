import { Building } from './Building.js';

export class CityGenerator {
  constructor() {
    this.buildings = [];
  }

  generate(gridSize = 10, blockSpacing = 20) {
    this.buildings = [];

    for (let row = -gridSize; row <= gridSize; row++) {
      for (let col = -gridSize; col <= gridSize; col++) {

        // Leave a clear flight corridor in the center
        const distFromCenter = Math.max(Math.abs(row), Math.abs(col));
        if (distFromCenter < 2) continue;

        const x = col * blockSpacing + (Math.random() - 0.5) * 6;
        const z = row * blockSpacing + (Math.random() - 0.5) * 6;

        // Taller buildings near edges (more dramatic silhouette)
        const heightBias = distFromCenter / gridSize;
        const height = 10 + Math.random() * 60 * heightBias + heightBias * 20;
        const width  = 4 + Math.random() * 8;
        const depth  = 4 + Math.random() * 8;

        this.buildings.push(new Building(x, z, width, height, depth));
      }
    }
    return this.buildings;
  }

  drawAll(gl, program, cubeGeometry) {
    for (const b of this.buildings) {
      b.draw(gl, program, cubeGeometry);
    }
  }
}