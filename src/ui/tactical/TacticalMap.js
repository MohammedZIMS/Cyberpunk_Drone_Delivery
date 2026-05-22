import { MapMarker, MARKER_TYPES } from './MapMarker.js';
import { CoordConverter }          from './CoordConverter.js';

// How many animation seconds between full building-layer redraws.
// Buildings don't move, so we only redraw them when zoom changes.
const BUILDING_REDRAW_INTERVAL = 0;  // 0 = always (changed at runtime if needed)

export class TacticalMap {
  /**
   * @param {HTMLCanvasElement} canvas   - The minimap canvas element
   * @param {Building[]}        buildings - City building array
   * @param {object}            [opts]
   * @param {number}            [opts.worldRadius=250]  - Half-extent of city
   * @param {number}            [opts.canvasSize=150]   - Canvas pixel size
   */
  constructor(canvas, buildings, opts = {}) {
    if (!canvas) throw new Error('TacticalMap: canvas element is null');

    this._canvas   = canvas;
    this._ctx      = canvas.getContext('2d');
    if (!this._ctx) throw new Error('TacticalMap: could not get 2D context');

    const canvasSize  = opts.canvasSize  || 150;
    const worldRadius = opts.worldRadius || 250;

    // Ensure the canvas pixel buffer matches its CSS size
    this._canvas.width  = canvasSize;
    this._canvas.height = canvasSize;

    this._converter = new CoordConverter(canvasSize, worldRadius, 12);

    // ── Building markers (created once, drawn from cached layer) ─────
    this._buildingMarkers = [];
    this._buildingCanvas  = document.createElement('canvas');
    this._buildingCanvas.width  = canvasSize;
    this._buildingCanvas.height = canvasSize;
    this._buildingDirty = true;

    // Find max building height for relative sizing
    this._maxBuildingHeight = buildings.reduce((m, b) => Math.max(m, b.height), 1);

    this._initBuildingMarkers(buildings);

    // ── Dynamic markers (drone, pickup, dropoff) ─────────────────────
    this._droneMarker   = new MapMarker(MARKER_TYPES.DRONE,   [0,0,0], { yaw: 0 });
    this._pickupMarker  = new MapMarker(MARKER_TYPES.PICKUP,  [0,0,0], { active: false });
    this._dropoffMarker = new MapMarker(MARKER_TYPES.DROPOFF, [0,0,0], { active: false });

    // ── Animation accumulator ────────────────────────────────────────
    this._time = 0;

    // ── Scan-line animation offset ───────────────────────────────────
    this._scanY = 0;

    // ── Zoom level (1.0 = default, higher = more zoomed in) ──────────
    this._zoom = 1.0;
  }

  // ═══════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Call every frame from the main game loop.
   * Fully independent of weather, WebGL state, or pause flag.
   *
   * @param {number}   dt          - delta time in seconds
   * @param {number[]} dronePos    - [x, y, z] world position
   * @param {number}   droneYaw    - drone heading in radians
   * @param {object}   missionData - { state, pickupPos, dropoffPos }
   */
  update(dt, dronePos, droneYaw, missionData) {
    this._time   += dt;
    this._scanY   = (this._scanY + dt * 30) % this._canvas.height;

    // Update coordinate converter drone-center
    const prevCX = this._converter._viewCenterX;
    const prevCZ = this._converter._viewCenterZ;
    this._converter.setDroneCenter(dronePos[0], dronePos[2], dt);

    // If the view center shifted by more than 2px, rebuild the building cache
    // so building footprints stay correctly positioned during drone movement
    const dcx = this._converter._viewCenterX - prevCX;
    const dcz = this._converter._viewCenterZ - prevCZ;
    const driftPx = Math.hypot(dcx, dcz) * this._converter.scale;
    if (driftPx > 1.5) this._buildingDirty = true;

    // ── Drone marker ─────────────────────────────────────────────────
    this._droneMarker.worldPos = dronePos;
    this._droneMarker.meta.yaw = droneYaw;
    this._droneMarker.update(dt);

    // ── Mission markers ───────────────────────────────────────────────
    const ms = missionData || {};
    this._updateMissionMarkers(ms.state, ms.pickupPos, ms.dropoffPos, dt);

    // ── Draw ──────────────────────────────────────────────────────────
    this._draw();
  }

  /**
   * Set zoom level. 1.0 = default view, 2.0 = 2× zoom in (smaller area shown).
   */
  setZoom(zoom) {
    this._zoom = Math.max(0.5, Math.min(4.0, zoom));
    // Recompute scale from zoom
    this._converter.scale = (this._converter.mapSize / this._converter.worldRange) * this._zoom;
    this._buildingDirty = true;
  }

  // ═══════════════════════════════════════════════════════════════════
  // PRIVATE — INIT
  // ═══════════════════════════════════════════════════════════════════

  _initBuildingMarkers(buildings) {
    for (const b of buildings) {
      const heightRatio = b.height / this._maxBuildingHeight;
      // Color varies by height: low=dark, mid=purple, tall=neon
      let edgeColor;
      if (heightRatio > 0.7)      edgeColor = '#00ffcc33';
      else if (heightRatio > 0.4) edgeColor = '#aa44ff22';
      else                        edgeColor = '#334455';

      const marker = new MapMarker(MARKER_TYPES.BUILDING, [b.x, b.height / 2, b.z], {
        mapW:        0,  // computed in draw from world size
        mapH:        0,
        worldW:      b.width,
        worldD:      b.depth,
        heightRatio,
        edgeColor,
      });
      this._buildingMarkers.push(marker);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // PRIVATE — MISSION MARKER LOGIC
  // ═══════════════════════════════════════════════════════════════════

  _updateMissionMarkers(state, pickupPos, dropoffPos, dt) {
    // PICKUP marker
    if (pickupPos && state === 'pickup') {
      this._pickupMarker.worldPos  = pickupPos;
      this._pickupMarker.active    = true;
      this._pickupMarker.update(dt);
    } else {
      this._pickupMarker.active = false;
    }

    // DROPOFF marker — only show when package is in transit
    if (dropoffPos && (state === 'transit' || state === 'done')) {
      this._dropoffMarker.worldPos = dropoffPos;
      this._dropoffMarker.active   = true;
      this._dropoffMarker.update(dt);
    } else {
      this._dropoffMarker.active = false;
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // PRIVATE — RENDERING
  // ═══════════════════════════════════════════════════════════════════

  _draw() {
    const ctx  = this._ctx;
    const size = this._canvas.width;
    const cx   = size / 2;
    const cy   = size / 2;

    // ── 1. Background ─────────────────────────────────────────────────
    ctx.clearRect(0, 0, size, size);

    // Radar background gradient
    const bgGrd = ctx.createRadialGradient(cx, cy, 0, cx, cy, size * 0.55);
    bgGrd.addColorStop(0,   'rgba(0,20,30,0.96)');
    bgGrd.addColorStop(0.7, 'rgba(0,12,20,0.98)');
    bgGrd.addColorStop(1,   'rgba(0,6,12,1)');
    ctx.beginPath();
    ctx.arc(cx, cy, size * 0.5, 0, Math.PI * 2);
    ctx.fillStyle = bgGrd;
    ctx.fill();

    // Clip everything to circular radar shape
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, size * 0.5 - 1, 0, Math.PI * 2);
    ctx.clip();

    // ── 2. Grid ───────────────────────────────────────────────────────
    this._drawGrid(ctx, size);

    // ── 3. Buildings (from cached layer) ─────────────────────────────
    this._drawBuildingLayer(ctx);

    // ── 4. Road grid hint ─────────────────────────────────────────────
    this._drawRoadHints(ctx, size);

    // ── 5. Range rings ────────────────────────────────────────────────
    this._drawRangeRings(ctx, cx, cy, size);

    // ── 6. Scan-line effect ───────────────────────────────────────────
    this._drawScanLine(ctx, size);

    // ── 7. Dynamic markers: dropoff → pickup → drone (lowest → highest z) ─
    this._drawMarker(this._dropoffMarker);
    this._drawMarker(this._pickupMarker);
    this._drawMarker(this._droneMarker);

    // ── 8. Distance lines from drone to active objectives ─────────────
    this._drawObjectiveLines(ctx, cx, cy);

    ctx.restore();  // release circular clip

    // ── 9. Border & compass ───────────────────────────────────────────
    this._drawBorder(ctx, cx, cy, size);
    this._drawCompassLabels(ctx, cx, cy, size);
  }

  _drawGrid(ctx, size) {
    const gridStep = this._converter.sizeToMap(25, 4);   // 25-unit world blocks
    ctx.strokeStyle = '#00ffcc0c';
    ctx.lineWidth   = 0.5;

    for (let px = 0; px < size; px += gridStep) {
      ctx.beginPath();
      ctx.moveTo(px, 0);
      ctx.lineTo(px, size);
      ctx.stroke();
    }
    for (let py = 0; py < size; py += gridStep) {
      ctx.beginPath();
      ctx.moveTo(0,    py);
      ctx.lineTo(size, py);
      ctx.stroke();
    }
  }

  _drawBuildingLayer(ctx) {
    // Rebuild the building cache whenever zoom/center changes
    if (this._buildingDirty) {
      this._rebuildBuildingCache();
      this._buildingDirty = false;
    }
    ctx.drawImage(this._buildingCanvas, 0, 0);
  }

  _rebuildBuildingCache() {
    const bCtx = this._buildingCanvas.getContext('2d');
    const size = this._buildingCanvas.width;
    bCtx.clearRect(0, 0, size, size);

    for (const m of this._buildingMarkers) {
      const { x, y } = this._converter.toMap(m.worldPos[0], m.worldPos[2]);
      // Only draw buildings within the visible area
      if (x < -10 || x > size + 10 || y < -10 || y > size + 10) continue;
      // Pixel footprint of building
      m.meta.mapW = this._converter.sizeToMap(m.meta.worldW, 2);
      m.meta.mapH = this._converter.sizeToMap(m.meta.worldD, 2);
      m.draw(bCtx, x, y, 0);
    }
  }

  _drawRoadHints(ctx, size) {
    // Faint horizontal/vertical band hints at block intersections
    const spacing = this._converter.sizeToMap(22, 8);
    const cx = size / 2;
    const cy = size / 2;
    ctx.strokeStyle = '#00ffcc06';
    ctx.lineWidth = spacing * 0.18;  // road width proportional to block size

    for (let px = cx % spacing; px < size; px += spacing) {
      ctx.beginPath();
      ctx.moveTo(px, 0);
      ctx.lineTo(px, size);
      ctx.stroke();
    }
    for (let py = cy % spacing; py < size; py += spacing) {
      ctx.beginPath();
      ctx.moveTo(0,    py);
      ctx.lineTo(size, py);
      ctx.stroke();
    }
  }

  _drawRangeRings(ctx, cx, cy, size) {
    const radii = [size * 0.18, size * 0.34, size * 0.5 - 1];
    ctx.setLineDash([2, 4]);
    for (let i = 0; i < radii.length; i++) {
      ctx.beginPath();
      ctx.arc(cx, cy, radii[i], 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(0,255,204,${0.05 + i * 0.03})`;
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }

  _drawScanLine(ctx, size) {
    // Animated horizontal scan line — pure visual flair
    const scanWidth = 3;
    const alpha     = 0.12;
    const grd = ctx.createLinearGradient(0, this._scanY - scanWidth,
                                          0, this._scanY + scanWidth);
    grd.addColorStop(0,   'rgba(0,255,204,0)');
    grd.addColorStop(0.5, `rgba(0,255,204,${alpha})`);
    grd.addColorStop(1,   'rgba(0,255,204,0)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, this._scanY - scanWidth, size, scanWidth * 2);
  }

  _drawMarker(marker) {
    if (!marker.visible || !marker.active) return;
    const { x, y } = this._converter.toMap(marker.worldPos[0], marker.worldPos[2]);
    // Don't draw if outside canvas
    if (x < -20 || x > this._canvas.width + 20) return;
    if (y < -20 || y > this._canvas.height + 20) return;
    marker.draw(this._ctx, x, y, this._time);
  }

  _drawObjectiveLines(ctx, cx, cy) {
    // Thin dashed lines from drone (centre) to active objectives
    const drawLine = (marker, color) => {
      if (!marker.active) return;
      const { x, y } = this._converter.toMap(marker.worldPos[0], marker.worldPos[2]);
      ctx.save();
      ctx.setLineDash([3, 5]);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(x, y);
      ctx.strokeStyle = color + '55';
      ctx.lineWidth   = 0.8;
      ctx.stroke();
      ctx.restore();
    };
    drawLine(this._pickupMarker,  '#00ddff');
    drawLine(this._dropoffMarker, '#ff00aa');
  }

  _drawBorder(ctx, cx, cy, size) {
    const r = size * 0.5 - 1;
    // Outer neon ring
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = '#00ffcc44';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Bright accent notches at cardinal positions
    const notchLen = 6;
    ctx.strokeStyle = '#00ffccaa';
    ctx.lineWidth = 2;
    for (const angle of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
      const cos = Math.cos(angle - Math.PI / 2);
      const sin = Math.sin(angle - Math.PI / 2);
      ctx.beginPath();
      ctx.moveTo(cx + cos * (r - notchLen), cy + sin * (r - notchLen));
      ctx.lineTo(cx + cos * r,              cy + sin * r);
      ctx.stroke();
    }

    // Inner subtle shadow ring
    ctx.beginPath();
    ctx.arc(cx, cy, r - 3, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 6;
    ctx.stroke();
  }

  _drawCompassLabels(ctx, cx, cy, size) {
    const r    = size * 0.5 - 8;
    const dirs = [
      { label: 'N', angle: -Math.PI / 2, color: '#ff4444' },
      { label: 'E', angle: 0,             color: '#00ffcc' },
      { label: 'S', angle:  Math.PI / 2,  color: '#00ffcc' },
      { label: 'W', angle:  Math.PI,      color: '#00ffcc' },
    ];
    ctx.font         = 'bold 8px Orbitron, monospace';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';

    for (const d of dirs) {
      const lx = cx + Math.cos(d.angle) * r;
      const ly = cy + Math.sin(d.angle) * r;
      ctx.fillStyle = d.color;
      ctx.fillText(d.label, lx, ly);
    }
  }
}
