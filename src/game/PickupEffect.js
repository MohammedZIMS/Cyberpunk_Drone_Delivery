/**
 * PickupEffect.js
 * Neon glow ring + rising particle burst played when the drone picks up a package.
 *
 * Rendered purely on a 2-D canvas overlay so it works with the existing
 * WebGL pipeline without touching any GL state.
 *
 * Usage:
 *   const fx = new PickupEffect(overlayCanvas2dCtx, camera);
 *   fx.trigger(worldPos);          // call once on pickup
 *   // inside loop:
 *   fx.update(dt);
 *   fx.draw();
 */

const PARTICLE_COUNT = 28;
const RING_DURATION  = 0.9;   // seconds the outer ring expands
const BURST_DURATION = 1.4;   // seconds particles live

export class PickupEffect {
  /**
   * @param {CanvasRenderingContext2D} ctx2d  – overlay 2-D canvas context
   * @param {Camera}                  camera  – game camera (has .worldToScreen())
   */
  constructor(ctx2d, camera) {
    this._ctx    = ctx2d;
    this._camera = camera;
    this._active = false;

    // Ring state
    this._ringTimer   = 0;
    this._worldPos    = [0, 0, 0];

    // Particles
    this._particles = [];
  }

  // ── Public API ──────────────────────────────────────────────────────────

  /** Fire the effect at the given world-space position. */
  trigger(worldPos) {
    this._worldPos  = [...worldPos];
    this._ringTimer = 0;
    this._active    = true;
    this._spawnParticles();
  }

  update(dt) {
    if (!this._active) return;
    this._ringTimer += dt;

    // Advance particles
    let anyAlive = false;
    for (const p of this._particles) {
      p.age += dt;
      p.x   += p.vx * dt;
      p.y   += p.vy * dt;
      p.vy  += 60 * dt;  // gravity drift
      if (p.age < BURST_DURATION) anyAlive = true;
    }

    if (this._ringTimer >= RING_DURATION && !anyAlive) {
      this._active = false;
    }
  }

  draw() {
    if (!this._active) return;

    const screen = this._worldToScreen(this._worldPos);
    if (!screen) return;

    const ctx = this._ctx;
    ctx.save();

    // ── Neon ring ──────────────────────────────────────────────────────
    if (this._ringTimer < RING_DURATION) {
      const t      = this._ringTimer / RING_DURATION;  // 0→1
      const eased  = 1 - (1 - t) * (1 - t);           // ease-out quad
      const radius = eased * 80;
      const alpha  = 1 - t;

      // Outer glow
      ctx.beginPath();
      ctx.arc(screen.x, screen.y, radius + 6, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255,200,0,${alpha * 0.4})`;
      ctx.lineWidth   = 14;
      ctx.stroke();

      // Sharp ring
      ctx.beginPath();
      ctx.arc(screen.x, screen.y, radius, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255,220,50,${alpha})`;
      ctx.lineWidth   = 2.5;
      ctx.shadowColor  = '#ffcc00';
      ctx.shadowBlur   = 20;
      ctx.stroke();
      ctx.shadowBlur   = 0;

      // Inner cyan ring (smaller, faster)
      const r2 = eased * 48;
      ctx.beginPath();
      ctx.arc(screen.x, screen.y, r2, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(0,255,200,${alpha * 0.9})`;
      ctx.lineWidth   = 1.5;
      ctx.shadowColor  = '#00ffcc';
      ctx.shadowBlur   = 16;
      ctx.stroke();
      ctx.shadowBlur   = 0;
    }

    // ── Particles ──────────────────────────────────────────────────────
    for (const p of this._particles) {
      const a = 1 - p.age / BURST_DURATION;
      if (a <= 0) continue;

      const sx = screen.x + p.x;
      const sy = screen.y + p.y;

      ctx.beginPath();
      ctx.arc(sx, sy, p.r * a, 0, Math.PI * 2);
      ctx.fillStyle   = p.color.replace('A', String(a));
      ctx.shadowColor = p.color.replace('A', '1');
      ctx.shadowBlur  = 8;
      ctx.fill();
    }
    ctx.shadowBlur = 0;

    ctx.restore();
  }

  get isActive() { return this._active; }

  // ── Private ─────────────────────────────────────────────────────────────

  _spawnParticles() {
    this._particles = [];
    const COLORS = [
      'rgba(255,220,50,A)',
      'rgba(0,255,200,A)',
      'rgba(255,80,200,A)',
      'rgba(255,150,0,A)',
      'rgba(80,200,255,A)',
    ];

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const angle  = (i / PARTICLE_COUNT) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
      const speed  = 40 + Math.random() * 90;
      this._particles.push({
        x:     0,
        y:     0,
        vx:    Math.cos(angle) * speed,
        vy:    Math.sin(angle) * speed - 30,  // slight upward bias
        r:     2 + Math.random() * 3.5,
        age:   Math.random() * 0.08,           // stagger start
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
      });
    }
  }

  /**
   * Project a 3-D world point to 2-D screen coords via the camera.
   * Falls back to a simple centre-of-canvas approximation if the camera
   * doesn't expose worldToScreen().
   *
   * @returns {{ x, y }} | null
   */
  _worldToScreen(worldPos) {
    // Prefer camera projection if available
    if (this._camera && typeof this._camera.worldToScreen === 'function') {
      return this._camera.worldToScreen(worldPos);
    }

    // Fallback: use canvas centre (good enough for centred objects)
    const cvs = this._ctx.canvas;
    return { x: cvs.width / 2, y: cvs.height / 2 };
  }
}
