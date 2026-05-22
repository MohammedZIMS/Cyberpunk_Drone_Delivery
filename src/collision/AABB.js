/**
 * AABB.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Axis-Aligned Bounding Box — the simplest and fastest 3D collision primitive.
 * Stored as a centre point + half-extents so overlap tests are symmetrical.
 *
 * Concept covered: AABB construction, overlap test, penetration depth,
 *                  point-to-AABB distance (for broad-phase culling).
 */

export class AABB {
  /**
   * @param {number} cx  Centre X
   * @param {number} cy  Centre Y
   * @param {number} cz  Centre Z
   * @param {number} hw  Half-width  (X extent)
   * @param {number} hh  Half-height (Y extent)
   * @param {number} hd  Half-depth  (Z extent)
   */
  constructor(cx, cy, cz, hw, hh, hd) {
    this.cx = cx;  this.cy = cy;  this.cz = cz;
    this.hw = hw;  this.hh = hh;  this.hd = hd;
  }

  /** Convenience factory: build from centre + full dimensions. */
  static fromCenterSize(cx, cy, cz, w, h, d) {
    return new AABB(cx, cy, cz, w / 2, h / 2, d / 2);
  }

  /** True when this box overlaps another (SAT on 3 axes). */
  overlaps(other) {
    return (
      Math.abs(this.cx - other.cx) < this.hw + other.hw &&
      Math.abs(this.cy - other.cy) < this.hh + other.hh &&
      Math.abs(this.cz - other.cz) < this.hd + other.hd
    );
  }

  /**
   * Penetration depth on each axis.
   * A value > 0 means the boxes overlap on that axis.
   */
  penetration(other) {
    return {
      x: (this.hw + other.hw) - Math.abs(this.cx - other.cx),
      y: (this.hh + other.hh) - Math.abs(this.cy - other.cy),
      z: (this.hd + other.hd) - Math.abs(this.cz - other.cz),
    };
  }

  /** Squared distance from this box's centre to a world point. */
  distSqTo(x, y, z) {
    return (this.cx - x) ** 2 + (this.cy - y) ** 2 + (this.cz - z) ** 2;
  }

  /** Reposition the box centre without changing its size. */
  moveTo(cx, cy, cz) { this.cx = cx; this.cy = cy; this.cz = cz; }
}