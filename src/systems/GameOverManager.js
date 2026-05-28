import { PlayTimeTracker } from './PlayTimeTracker.js';

export class GameOverManager {
  constructor() {
    this._el      = null;
    this._visible = false;
    this._inject();

    // Callbacks wired by main.js
    this.onRestart  = null;
    this.onMainMenu = null;
  }

  // ── Show / Hide ──────────────────────────────────────────────────────

  /**
   * Show the game over screen with final statistics.
   * @param {object} stats
   * @param {number} stats.score
   * @param {number} stats.highScore
   * @param {number} stats.deliveries
   * @param {number} stats.pickups
   * @param {number} stats.activeTime    seconds
   * @param {number} stats.totalTime     seconds
   * @param {number} stats.maxSpeed      m/s
   * @param {number} stats.distance      world units
   * @param {number} stats.wave
   */
  show(stats) {
    const s = stats;
    this._set('go-score',      s.score.toLocaleString());
    this._set('go-hi',         s.highScore.toLocaleString());
    this._set('go-deliveries', s.deliveries);
    this._set('go-pickups',    s.pickups);
    this._set('go-playtime',   PlayTimeTracker.format(s.activeTime));
    this._set('go-totaltime',  PlayTimeTracker.format(s.totalTime));
    this._set('go-speed',      (s.maxSpeed * 3.6).toFixed(0) + ' km/h');
    this._set('go-distance',   Math.round(s.distance) + ' m');
    this._set('go-wave',       s.wave);

    this._el.style.display = 'flex';
    this._visible = true;
  }

  hide() {
    this._el.style.display = 'none';
    this._visible = false;
  }

  isVisible() { return this._visible; }

  // ── DOM injection ────────────────────────────────────────────────────

  _inject() {
    const div = document.createElement('div');
    div.id = 'game-over-screen';
    div.innerHTML = `
      <div class="go-panel">

        <!-- Corner brackets -->
        <div class="go-corner go-tl"></div>
        <div class="go-corner go-tr"></div>
        <div class="go-corner go-bl"></div>
        <div class="go-corner go-br"></div>

        <!-- Scan-line overlay -->
        <div class="go-scan"></div>

        <!-- Header -->
        <div class="go-eyebrow">// UNIT DESTROYED //</div>
        <div class="go-title">GAME<br>OVER</div>
        <div class="go-divider"></div>

        <!-- Stats grid -->
        <div class="go-stats">
          <div class="go-stat">
            <span class="go-label">FINAL SCORE</span>
            <span class="go-val" id="go-score" style="color:#00ffcc;font-size:26px;">0</span>
          </div>
          <div class="go-stat">
            <span class="go-label">HIGH SCORE</span>
            <span class="go-val" id="go-hi" style="color:#ffaa00;">0</span>
          </div>
          <div class="go-stat">
            <span class="go-label">DELIVERIES</span>
            <span class="go-val" id="go-deliveries">0</span>
          </div>
          <div class="go-stat">
            <span class="go-label">PICKUPS</span>
            <span class="go-val" id="go-pickups">0</span>
          </div>
          <div class="go-stat">
            <span class="go-label">ACTIVE TIME</span>
            <span class="go-val" id="go-playtime">00:00:00</span>
          </div>
          <div class="go-stat">
            <span class="go-label">SESSION TIME</span>
            <span class="go-val" id="go-totaltime">00:00:00</span>
          </div>
          <div class="go-stat">
            <span class="go-label">TOP SPEED</span>
            <span class="go-val" id="go-speed">0 km/h</span>
          </div>
          <div class="go-stat">
            <span class="go-label">DISTANCE</span>
            <span class="go-val" id="go-distance">0 m</span>
          </div>
          <div class="go-stat go-stat-full">
            <span class="go-label">WAVE REACHED</span>
            <span class="go-val" id="go-wave" style="color:#aa88ff;">1</span>
          </div>
        </div>

        <div class="go-divider"></div>

        <!-- Buttons -->
        <div class="go-buttons">
          <button id="go-restart-btn"  class="go-btn go-btn-cyan">▶ RESTART MISSION</button>
          <button id="go-menu-btn"     class="go-btn go-btn-ghost">⏏ MAIN MENU</button>
        </div>

        <div class="go-footer">ESC · R to restart</div>
      </div>
    `;

    document.body.appendChild(div);
    this._el = div;

    // Button handlers
    document.getElementById('go-restart-btn').addEventListener('click', () => {
      this.hide();
      if (this.onRestart) this.onRestart();
    });
    document.getElementById('go-menu-btn').addEventListener('click', () => {
      this.hide();
      if (this.onMainMenu) this.onMainMenu();
    });

    // Keyboard shortcuts (R = restart, ESC = menu)
    document.addEventListener('keydown', e => {
      if (!this._visible) return;
      if (e.key.toLowerCase() === 'r') {
        this.hide();
        if (this.onRestart) this.onRestart();
      }
    });

    this._injectStyles();
    div.style.display = 'none';
  }

  _set(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  _injectStyles() {
    const style = document.createElement('style');
    style.textContent = `
      /* ═══ GAME OVER SCREEN ═══════════════════════════════════════════ */
      #game-over-screen {
        position: fixed; inset: 0;
        display: none; align-items: center; justify-content: center;
        z-index: 3000;
        background: radial-gradient(ellipse at center,
          rgba(5,0,15,0.97) 0%, rgba(0,0,5,0.99) 100%);
        font-family: 'Orbitron', monospace;
      }

      .go-panel {
        position: relative;
        border: 1px solid #ff225544;
        background: linear-gradient(160deg, #0a0010ee, #050020ee);
        box-shadow:
          0 0 80px rgba(255,34,85,0.15),
          0 0 160px rgba(255,34,85,0.07),
          inset 0 0 60px rgba(255,34,85,0.05);
        padding: 48px 56px;
        min-width: 480px;
        max-width: 560px;
        width: 90vw;
        overflow: hidden;
      }

      /* Corner brackets */
      .go-corner {
        position: absolute; width: 22px; height: 22px;
        border-color: #ff225588; border-style: solid;
      }
      .go-tl { top:8px;    left:8px;   border-width: 2px 0 0 2px; }
      .go-tr { top:8px;    right:8px;  border-width: 2px 2px 0 0; }
      .go-bl { bottom:8px; left:8px;   border-width: 0 0 2px 2px; }
      .go-br { bottom:8px; right:8px;  border-width: 0 2px 2px 0; }

      /* Scan-line overlay */
      .go-scan {
        position: absolute; inset: 0; pointer-events: none;
        background: repeating-linear-gradient(
          0deg, transparent, transparent 2px,
          rgba(255,34,85,0.02) 2px, rgba(255,34,85,0.02) 4px);
      }

      .go-eyebrow {
        font-size: 9px; letter-spacing: 5px;
        color: #ff225566; text-align: center; margin-bottom: 8px;
      }

      .go-title {
        font-size: 52px; font-weight: 900;
        letter-spacing: 6px; line-height: 1;
        color: #ff2255;
        text-shadow: 0 0 20px #ff2255, 0 0 60px #ff225566,
                     0 0 100px #ff225533;
        text-align: center; margin-bottom: 20px;
      }

      .go-divider {
        height: 1px; margin: 18px 0;
        background: linear-gradient(90deg,
          transparent, #ff225544, transparent);
      }

      /* Stats grid */
      .go-stats {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 14px 24px;
        margin: 4px 0;
      }
      .go-stat {
        display: flex; flex-direction: column; gap: 3px;
      }
      .go-stat-full { grid-column: 1 / -1; align-items: center; }

      .go-label {
        font-size: 8px; letter-spacing: 3px;
        color: #ff225566; text-transform: uppercase;
      }
      .go-val {
        font-size: 18px; letter-spacing: 2px;
        color: #ff8899;
        text-shadow: 0 0 10px currentColor;
      }

      /* Buttons */
      .go-buttons {
        display: flex; flex-direction: column;
        gap: 12px; align-items: center; margin-top: 8px;
      }
      .go-btn {
        font-family: 'Orbitron', monospace;
        font-size: 11px; letter-spacing: 4px;
        padding: 14px 36px; width: 100%;
        background: transparent; border: 1px solid;
        cursor: pointer; text-transform: uppercase;
        transition: all .18s;
      }
      .go-btn-cyan {
        color: #00ffcc; border-color: #00ffcc44;
      }
      .go-btn-cyan:hover {
        background: rgba(0,255,204,0.1);
        box-shadow: 0 0 24px #00ffcc44;
        border-color: #00ffcc;
      }
      .go-btn-ghost {
        color: #aaaacc; border-color: #aaaacc33;
      }
      .go-btn-ghost:hover {
        background: rgba(170,170,204,0.06);
        border-color: #aaaacc66;
      }

      .go-footer {
        text-align: center; font-size: 8px;
        letter-spacing: 3px; color: #ff225533;
        margin-top: 16px;
      }
    `;
    document.head.appendChild(style);
  }
}
