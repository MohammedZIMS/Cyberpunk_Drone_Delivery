export const MARKER_TYPES = {
  DRONE:    'drone',
  PICKUP:   'pickup',
  DROPOFF:  'dropoff',
  BUILDING: 'building',
  OBSTACLE: 'obstacle',
};

// Visual config per marker type
const TYPE_CONFIG = {
  [MARKER_TYPES.DRONE]: {
    color:     '#00ffcc',
    glow:      '#00ffcc',
    glowAlpha: 0.55,
    radius:    6,
    shape:     'arrow',     // draws directional arrow
    pulsate:   false,
    zIndex:    10,
  },
  [MARKER_TYPES.PICKUP]: {
    color:     '#00ddff',
    glow:      '#00aaff',
    glowAlpha: 0.6,
    radius:    7,
    shape:     'beacon',    // pulsing beacon ring + diamond
    pulsate:   true,
    zIndex:    8,
  },
  [MARKER_TYPES.DROPOFF]: {
    color:     '#ff00aa',
    glow:      '#ff0066',
    glowAlpha: 0.6,
    radius:    7,
    shape:     'target',    // concentric rings
    pulsate:   true,
    zIndex:    8,
  },
  [MARKER_TYPES.BUILDING]: {
    color:     '#1a2a3a',
    glow:      null,
    glowAlpha: 0,
    radius:    0,           // width/depth used instead
    shape:     'rect',
    pulsate:   false,
    zIndex:    1,
  },
  [MARKER_TYPES.OBSTACLE]: {
    color:     '#ff4400',
    glow:      '#ff2200',
    glowAlpha: 0.3,
    radius:    3,
    shape:     'dot',
    pulsate:   false,
    zIndex:    4,
  },
};

export class MapMarker {
  /**
   * @param {string} type     - MARKER_TYPES constant
   * @param {number[]} worldPos - [x, y, z] in world units
   * @param {object} [meta]   - Optional extra data (width, depth, yaw, label)
   */
  constructor(type, worldPos, meta = {}) {
    this.type     = type;
    this.worldPos = worldPos;  // [x, y, z]
    this.meta     = meta;      // { width, depth, yaw, label, active }

    // Smooth-interpolated map position (px) to avoid jitter
    this._mapX   = 0;
    this._mapY   = 0;

    // Independent animation phase so markers don't all sync
    this._phase  = Math.random() * Math.PI * 2;

    // Visibility
    this.visible  = true;
    this.active   = meta.active !== false;

    this._cfg = TYPE_CONFIG[type] || TYPE_CONFIG[MARKER_TYPES.OBSTACLE];
  }

  /** Update animation phase. dt in seconds. */
  update(dt) {
    this._phase += dt * 2.8;
  }

  /**
   * Draw this marker onto the 2D canvas context.
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} mx  - already-converted map X pixel
   * @param {number} my  - already-converted map Y pixel
   * @param {number} t   - global time accumulator (seconds)
   */
  draw(ctx, mx, my, t) {
    if (!this.visible || !this.active) return;

    const cfg = this._cfg;
    ctx.save();
    ctx.translate(mx, my);

    switch (cfg.shape) {
      case 'arrow':    this._drawArrow(ctx, cfg, t);   break;
      case 'beacon':   this._drawBeacon(ctx, cfg, t);  break;
      case 'target':   this._drawTarget(ctx, cfg, t);  break;
      case 'rect':     this._drawRect(ctx, cfg);        break;
      case 'dot':
      default:         this._drawDot(ctx, cfg, t);     break;
    }

    ctx.restore();
  }

  // ─────────────────────────────────────────────────────────────────
  // SHAPES
  // ─────────────────────────────────────────────────────────────────

  /** Drone: directional arrow that rotates with yaw */
  _drawArrow(ctx, cfg, t) {
    const yaw = this.meta.yaw || 0;
    ctx.rotate(-yaw);  // canvas Y is flipped vs world Z

    // Outer glow halo
    const glowR = cfg.radius + 4;
    const grd = ctx.createRadialGradient(0, 0, 1, 0, 0, glowR);
    grd.addColorStop(0, cfg.color + 'cc');
    grd.addColorStop(1, cfg.glow + '00');
    ctx.beginPath();
    ctx.arc(0, 0, glowR, 0, Math.PI * 2);
    ctx.fillStyle = grd;
    ctx.fill();

    // Arrow body (pointing up = forward)
    ctx.beginPath();
    ctx.moveTo(0, -cfg.radius);           // tip
    ctx.lineTo( cfg.radius * 0.55,  cfg.radius * 0.6);
    ctx.lineTo(0,  cfg.radius * 0.25);
    ctx.lineTo(-cfg.radius * 0.55,  cfg.radius * 0.6);
    ctx.closePath();
    ctx.fillStyle = cfg.color;
    ctx.fill();

    // White center dot
    ctx.beginPath();
    ctx.arc(0, 0, 2, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  }

  /** Pickup: pulsing beacon — outer ring + cyan diamond */
  _drawBeacon(ctx, cfg, t) {
    const pulse = 0.5 + Math.sin(this._phase) * 0.5;  // 0..1

    // Outer expanding beacon ring
    const ringR = cfg.radius + 4 + pulse * 10;
    ctx.beginPath();
    ctx.arc(0, 0, ringR, 0, Math.PI * 2);
    ctx.strokeStyle = cfg.glow + Math.floor(pulse * 0.5 * 255).toString(16).padStart(2,'0');
    ctx.lineWidth = 1;
    ctx.stroke();

    // Second inner ring
    const ringR2 = cfg.radius + 2 + pulse * 4;
    ctx.beginPath();
    ctx.arc(0, 0, ringR2, 0, Math.PI * 2);
    ctx.strokeStyle = cfg.color + '88';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Glow fill
    const grd = ctx.createRadialGradient(0, 0, 0, 0, 0, cfg.radius + 2);
    grd.addColorStop(0, cfg.color + 'ff');
    grd.addColorStop(1, cfg.color + '00');
    ctx.beginPath();
    ctx.arc(0, 0, cfg.radius + 2, 0, Math.PI * 2);
    ctx.fillStyle = grd;
    ctx.fill();

    // Diamond shape (package icon)
    const d = cfg.radius * 0.9;
    ctx.beginPath();
    ctx.moveTo(0, -d);
    ctx.lineTo(d, 0);
    ctx.lineTo(0, d);
    ctx.lineTo(-d, 0);
    ctx.closePath();
    ctx.fillStyle = cfg.color;
    ctx.fill();
    ctx.strokeStyle = '#ffffff44';
    ctx.lineWidth = 0.5;
    ctx.stroke();

    // Package cross lines
    ctx.beginPath();
    ctx.moveTo(-d * 0.4, 0);
    ctx.lineTo( d * 0.4, 0);
    ctx.moveTo(0, -d * 0.4);
    ctx.lineTo(0,  d * 0.4);
    ctx.strokeStyle = '#ffffff88';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  /** Dropoff: target concentric rings with magenta color */
  _drawTarget(ctx, cfg, t) {
    const pulse = 0.5 + Math.sin(this._phase) * 0.5;

    // Outer spinning rings
    ctx.save();
    ctx.rotate(this._phase * 0.4);
    for (let i = 3; i >= 1; i--) {
      const r = cfg.radius + i * 5;
      const alpha = (0.15 + pulse * 0.15) / i;
      ctx.beginPath();
      // Draw dashed ring effect with arc segments
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
        ctx.arc(0, 0, r, a, a + Math.PI / 6);
      }
      ctx.strokeStyle = cfg.color;
      ctx.globalAlpha = alpha;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    ctx.restore();
    ctx.globalAlpha = 1;

    // Holographic pulse wave
    const waveR = cfg.radius + 2 + pulse * 8;
    const grdW = ctx.createRadialGradient(0, 0, cfg.radius, 0, 0, waveR);
    grdW.addColorStop(0, cfg.glow + '66');
    grdW.addColorStop(1, cfg.glow + '00');
    ctx.beginPath();
    ctx.arc(0, 0, waveR, 0, Math.PI * 2);
    ctx.fillStyle = grdW;
    ctx.fill();

    // Solid center
    const grd = ctx.createRadialGradient(0, 0, 0, 0, 0, cfg.radius);
    grd.addColorStop(0, '#ffffff');
    grd.addColorStop(0.4, cfg.color + 'ff');
    grd.addColorStop(1, cfg.color + '44');
    ctx.beginPath();
    ctx.arc(0, 0, cfg.radius, 0, Math.PI * 2);
    ctx.fillStyle = grd;
    ctx.fill();

    // Target cross-hair lines
    ctx.strokeStyle = cfg.color;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.7;
    const ch = cfg.radius + 4;
    ctx.beginPath();
    ctx.moveTo(-ch, 0); ctx.lineTo(-2, 0);
    ctx.moveTo(2, 0);   ctx.lineTo(ch, 0);
    ctx.moveTo(0, -ch); ctx.lineTo(0, -2);
    ctx.moveTo(0, 2);   ctx.lineTo(0, ch);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  /** Building: rectangle footprint */
  _drawRect(ctx, cfg) {
    // meta.mapW and meta.mapH are pre-computed pixel dimensions
    const w = this.meta.mapW || 4;
    const h = this.meta.mapH || 4;
    ctx.fillStyle = cfg.color;
    ctx.globalAlpha = 0.7 + (this.meta.heightRatio || 0) * 0.3;
    ctx.fillRect(-w / 2, -h / 2, w, h);
    // Neon edge highlight on tall buildings
    if ((this.meta.heightRatio || 0) > 0.5) {
      ctx.strokeStyle = this.meta.edgeColor || '#00ffcc22';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(-w / 2, -h / 2, w, h);
    }
    ctx.globalAlpha = 1;
  }

  /** Generic small dot */
  _drawDot(ctx, cfg, t) {
    const pulse = 0.6 + Math.sin(this._phase) * 0.4;
    if (cfg.glow) {
      const grd = ctx.createRadialGradient(0, 0, 0, 0, 0, cfg.radius + 3);
      grd.addColorStop(0, cfg.glow + Math.floor(cfg.glowAlpha * 255).toString(16).padStart(2,'0'));
      grd.addColorStop(1, cfg.glow + '00');
      ctx.beginPath();
      ctx.arc(0, 0, cfg.radius + 3, 0, Math.PI * 2);
      ctx.fillStyle = grd;
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(0, 0, cfg.radius * pulse, 0, Math.PI * 2);
    ctx.fillStyle = cfg.color;
    ctx.fill();
  }
}
