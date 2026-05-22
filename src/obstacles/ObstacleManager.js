import { FlyingCar }   from './FlyingCar.js';
import { ElectricWire } from './ElectricWire.js';
import { Billboard }   from './Billboard.js';

export class ObstacleManager {
  constructor(buildings) {
    this.cars       = [];
    this.wires      = [];
    this.billboards = [];

    this._spawnCars(buildings);
    this._spawnWires(buildings);
    this._spawnBillboards(buildings);
  }

  // ── Spawners ─────────────────────────────────────────────────────

  _spawnCars(buildings) {
    // Pick random pairs of tall buildings as route waypoints
    const tall = buildings.filter(b => b.height > 25);

    for (let i = 0; i < Math.min(18, Math.floor(tall.length / 2)); i++) {
      // Shuffle pick 4 buildings as Bézier control points
      const picks = this._randomPicks(tall, 4);
      const alt   = 15 + Math.random() * 25; // flight altitude

      const pts = picks.map(b => [
        b.x + (Math.random() - 0.5) * 10,
        alt + (Math.random() - 0.5) * 6,
        b.z + (Math.random() - 0.5) * 10,
      ]);

      this.cars.push(new FlyingCar(
        pts[0], pts[1], pts[2], pts[3],
        0.05 + Math.random() * 0.08
      ));
    }
  }

  _spawnWires(buildings) {
    // String wires between pairs of nearby buildings at mid-height
    const shuffled = [...buildings].sort(() => Math.random() - 0.5);

    for (let i = 0; i < shuffled.length - 1 && this.wires.length < 30; i++) {
      const a = shuffled[i];
      const b = shuffled[i + 1];

      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const dist = Math.sqrt(dx*dx + dz*dz);

      // Only connect buildings that are reasonably close
      if (dist > 35 || dist < 8) continue;

      const altA = a.height * (0.3 + Math.random() * 0.4);
      const altB = b.height * (0.3 + Math.random() * 0.4);

      this.wires.push(new ElectricWire(
        [a.x, altA, a.z],
        [b.x, altB, b.z],
        0.25 + Math.random() * 0.2
      ));
    }
  }

  _spawnBillboards(buildings) {
    const tall = buildings.filter(b => b.height > 20);

    for (const b of tall) {
      if (Math.random() > 0.4) continue; // 40% of tall buildings get a sign

      const side  = Math.floor(Math.random() * 4); // 0=front,1=right,2=back,3=left
      const yaws  = [0, Math.PI/2, Math.PI, -Math.PI/2];
      const yaw   = yaws[side];

      const hw = b.width  / 2 + 0.2;
      const hd = b.depth  / 2 + 0.2;
      const offsets = [
        [0,      0, -hd],
        [hw,     0,   0],
        [0,      0,  hd],
        [-hw,    0,   0],
      ];
      const off = offsets[side];

      const signH = 5 + Math.random() * 4;
      const signY = b.height * (0.5 + Math.random() * 0.3);

      this.billboards.push(new Billboard(
        [b.x + off[0], signY, b.z + off[2]],
        yaw,
        6 + Math.random() * 6,
        signH
      ));
    }
  }

  _randomPicks(arr, n) {
    const copy = [...arr];
    const out  = [];
    for (let i = 0; i < n && copy.length; i++) {
      const idx = Math.floor(Math.random() * copy.length);
      out.push(copy.splice(idx, 1)[0]);
    }
    return out;
  }

  // ── Per-frame ─────────────────────────────────────────────────────

  update(dt) {
    for (const car  of this.cars)       car.update(dt);
    for (const wire of this.wires)      wire.update(dt);
    for (const bb   of this.billboards) bb.update(dt);
  }

  drawAll(gl, program, cubeGeo) {
    for (const car  of this.cars)       car.draw(gl, program, cubeGeo);
    for (const wire of this.wires)      wire.draw(gl, program, cubeGeo);
    for (const bb   of this.billboards) bb.draw(gl, program, cubeGeo);
  }

  // Expose arrays so CollisionDetector can read them
  getCars()       { return this.cars; }
  getWires()      { return this.wires; }
  getBillboards() { return this.billboards; }
}