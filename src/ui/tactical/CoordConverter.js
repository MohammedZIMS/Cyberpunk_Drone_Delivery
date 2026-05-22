export class CoordConverter {
  constructor(canvasSize = 150, worldRadius = 250, padding = 12) {
    this.canvasSize  = canvasSize;
    this.padding     = padding;
    // The drawable region inside the canvas (square)
    this.mapSize     = canvasSize - padding * 2;
    // Scale: world units → canvas pixels
    // worldRadius covers one side of the square city, so the full
    // visible range is 2 * worldRadius
    this.worldRange  = worldRadius * 2;
    this.scale       = this.mapSize / this.worldRange;

    // When drone-centric mode is on, the map scrolls so the drone
    // is always at the centre. `_viewCenter` is in world units.
    this._droneCenter = true;
    this._viewCenterX = 0;
    this._viewCenterZ = 0;
    // Smooth the view center to avoid snapping
    this._smoothX = 0;
    this._smoothZ = 0;
  }

  /**
   * Set the drone's world position for drone-centred scrolling.
   * Call this once per frame before converting any coordinates.
   * @param {number} wx - drone world X
   * @param {number} wz - drone world Z
   * @param {number} dt - delta time for smooth lerp
   */
  setDroneCenter(wx, wz, dt) {
    const alpha = 1 - Math.exp(-8 * dt);
    this._smoothX += (wx - this._smoothX) * alpha;
    this._smoothZ += (wz - this._smoothZ) * alpha;
    this._viewCenterX = this._smoothX;
    this._viewCenterZ = this._smoothZ;
  }

  /**
   * Convert world [x, z] → canvas [px, py].
   * Note: world Z maps to canvas Y (both are "depth" axes).
   * World X maps to canvas X (both are "side" axes).
   *
   * @param {number} wx  - world X coordinate
   * @param {number} wz  - world Z coordinate
   * @returns {{ x: number, y: number }}
   */
  toMap(wx, wz) {
    // Offset relative to current view center
    const relX = wx - this._viewCenterX;
    const relZ = wz - this._viewCenterZ;

    // Scale and center in canvas
    const cx = this.canvasSize / 2;
    const cy = this.canvasSize / 2;

    return {
      x: cx + relX * this.scale,
      y: cy + relZ * this.scale,   // Z→Y, no flip needed for top-down
    };
  }

  /**
   * Check whether a world position is currently visible on the minimap.
   * @param {number} wx
   * @param {number} wz
   * @param {number} [margin] - pixel margin before clipping
   */
  isVisible(wx, wz, margin = 0) {
    const { x, y } = this.toMap(wx, wz);
    const lo = margin;
    const hi = this.canvasSize - margin;
    return x >= lo && x <= hi && y >= lo && y <= hi;
  }

  /**
   * Compute pixel size for a world-space dimension (e.g., building footprint).
   * Clamps to minimum 1px so tiny buildings still show as 1px marks.
   * @param {number} worldSize
   * @param {number} [min]
   */
  sizeToMap(worldSize, min = 1) {
    return Math.max(min, worldSize * this.scale);
  }

  /** Returns the square half-extent of the visible world area, in world units. */
  get visibleRadius() {
    return (this.canvasSize / 2) / this.scale;
  }
}
