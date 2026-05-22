/**
 * CollisionDetector.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Two-phase collision detection:
 *
 *   Broad phase  — cheap radius check to discard distant objects.
 *   Narrow phase — accurate AABB overlap + penetration depth for survivors.
 *
 * Also handles capsule (point-to-segment) tests for electric wires.
 *
 * Concept covered: broad/narrow phase, minimum penetration axis resolution,
 *                  point-to-line-segment distance, collision normal.
 */

import { AABB } from './AABB.js';

/** Only test objects whose centre is within this radius of the drone. */
const BROAD_RADIUS_SQ   = 42 * 42;
/** Impact speed (m/s) that triggers health damage. */
const DAMAGE_THRESHOLD  = 4.0;
/** Wire threshold is lower — they're harder to avoid. */
const WIRE_DMG_THRESHOLD = 2.5;

export class CollisionDetector {
  constructor(buildings) {
    // Pre-build static building AABBs (computed once, never moved)
    this.buildingBoxes = buildings.map(b =>
      AABB.fromCenterSize(b.x, b.height / 2, b.z, b.width, b.height, b.depth)
    );

    // Obstacle references — filled in after ObstacleManager is created
    this.cars       = [];
    this.wires      = [];
    this.billboards = [];
  }

  setObstacles(cars, wires, billboards) {
    this.cars       = cars;
    this.wires      = wires;
    this.billboards = billboards;
  }

  /**
   * Run collision detection for one frame.
   *
   * @param {number[]} pos           Drone centre [x, y, z]
   * @param {number[]} vel           Drone velocity [vx, vy, vz]
   * @param {number[]} halfExtents   Drone AABB half-sizes [hw, hh, hd]
   * @returns {{ hit, normal, push, impactSpeed, isDamaging }}
   */
  check(pos, vel, halfExtents = [1.3, 0.22, 1.3]) {
    const [px, py, pz] = pos;
    const [hw, hh, hd] = halfExtents;
    const droneBox = new AABB(px, py, pz, hw, hh, hd);

    // ── 1. Buildings (static AABB list) ─────────────────────────────────
    const bHit = this._checkAABBList(droneBox, pos, vel, this.buildingBoxes, 'building');
    if (bHit) return bHit;

    // ── 2. Flying cars (dynamic AABBs) ──────────────────────────────────
    for (const car of this.cars) {
      const a = car.getAABB();
      if ((a.cx-px)**2+(a.cy-py)**2+(a.cz-pz)**2 > BROAD_RADIUS_SQ) continue;
      const box = new AABB(a.cx, a.cy, a.cz, a.hw, a.hh, a.hd);
      if (!droneBox.overlaps(box)) continue;
      const r = this._resolveAABB(droneBox.penetration(box), pos, box, vel);
      if (r) { r.obstacleType = 'car'; return r; }
    }

    // ── 3. Electric wires (capsule / point-segment test) ────────────────
    for (const wire of this.wires) {
      const threshold = wire.radius + Math.max(hw, hd);
      const distSq    = wire.distSqToPoint(pos);
      if (distSq >= threshold * threshold) continue;

      const cp  = wire.closestPointOnSegment(pos);
      const nx  = px - cp[0];
      const ny  = py - cp[1];
      const nz  = pz - cp[2];
      const len = Math.sqrt(nx*nx + ny*ny + nz*nz) || 1;
      const pen = threshold - Math.sqrt(distSq);

      const impactSpeed = Math.abs(
        vel[0]*(nx/len) + vel[1]*(ny/len) + vel[2]*(nz/len));

      wire.triggerSpark();

      return {
        hit:          true,
        normal:       [nx/len, ny/len, nz/len],
        push:         [nx/len * pen, ny/len * pen, nz/len * pen],
        impactSpeed,
        isDamaging:   impactSpeed > WIRE_DMG_THRESHOLD,
        obstacleType: 'wire',
      };
    }

    // ── 4. Billboards (static AABB) ──────────────────────────────────────
    for (const bb of this.billboards) {
      const a = bb.getAABB();
      if ((a.cx-px)**2+(a.cy-py)**2+(a.cz-pz)**2 > BROAD_RADIUS_SQ) continue;
      const box = new AABB(a.cx, a.cy, a.cz, a.hw, a.hh, a.hd);
      if (!droneBox.overlaps(box)) continue;
      const r = this._resolveAABB(droneBox.penetration(box), pos, box, vel);
      if (r) { r.obstacleType = 'billboard'; return r; }
    }

    return { hit: false, normal:[0,0,0], push:[0,0,0], impactSpeed:0, isDamaging:false };
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  _checkAABBList(droneBox, pos, vel, boxes, type) {
    const [px, py, pz] = pos;
    for (const box of boxes) {
      if (box.distSqTo(px, py, pz) > BROAD_RADIUS_SQ) continue;
      if (!droneBox.overlaps(box)) continue;
      const r = this._resolveAABB(droneBox.penetration(box), pos, box, vel);
      if (r) { r.obstacleType = type; return r; }
    }
    return null;
  }

  /**
   * Given the penetration depths, resolve along the axis of minimum penetration.
   * Returns a hit descriptor or null if no real penetration.
   */
  _resolveAABB(pen, pos, box, vel) {
    const [px, py, pz] = pos;
    const minPen = Math.min(pen.x, pen.y, pen.z);
    if (minPen <= 0) return null;

    let normal, push;

    if (minPen === pen.x) {
      const s = px < box.cx ? -1 : 1;
      normal = [s, 0, 0];
      push   = [s * pen.x, 0, 0];
    } else if (minPen === pen.y) {
      const s = py < box.cy ? -1 : 1;
      normal = [0, s, 0];
      push   = [0, s * pen.y, 0];
    } else {
      const s = pz < box.cz ? -1 : 1;
      normal = [0, 0, s];
      push   = [0, 0, s * pen.z];
    }

    const impactSpeed = Math.abs(
      vel[0]*normal[0] + vel[1]*normal[1] + vel[2]*normal[2]);

    return {
      hit: true,
      normal,
      push,
      impactSpeed,
      isDamaging: impactSpeed > DAMAGE_THRESHOLD,
    };
  }
}