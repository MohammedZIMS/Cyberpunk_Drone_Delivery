// ══════════════════════════════════════════════════════════════════════════════
//  Tutorial.js  –  In-game Tutorial overlay
//  Responsibilities (SOC):
//    • Inject tutorial HTML + styles (once)
//    • Show / hide the overlay
//    • Highlight keyboard badges on keydown / keyup  (activateKeyHighlights)
//  Non-responsibilities: game state, scoring, audio — those live elsewhere.
// ══════════════════════════════════════════════════════════════════════════════

export class Tutorial {
  constructor() {
    this._visible = false;
    this._injectStyles();
    this._inject();
    this.activateKeyHighlights();
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  show() {
    this._visible = true;
    document.getElementById('screen-tutorial').style.display = 'flex';
  }

  hide() {
    this._visible = false;
    document.getElementById('screen-tutorial').style.display = 'none';
  }

  /** Toggle visibility — used by the H key binding in main.js. */
  toggle() {
    if (this._visible) this.hide(); else this.show();
  }

  /** Wire the close button to a caller-supplied callback. */
  onClose(fn) {
    this._closeCb = fn;
  }

  // ── Key highlights ─────────────────────────────────────────────────────────

  /**
   * Listen for keydown/keyup and pulse the matching .tut-key badge.
   * KEY_MAP: lowercased e.key → badge inner-text (must match HTML exactly).
   */
  activateKeyHighlights() {
    const KEY_MAP = {
      'a'          : 'A',
      'w'          : 'W',
      's'          : 'S',
      'd'          : 'D',
      'arrowup'    : '↑',
      'arrowdown'  : '↓',
      'arrowleft'  : '←',
      'arrowright' : '→',
      'shift'      : '⇧',
      'f'          : 'F',
      ' '          : 'SPC',
      'p'          : 'P',
      'h'          : 'H',
      'escape'     : 'ESC',
    };

    // Single shared lookup — avoids querying the DOM on every event.
    const getBadge = (label) =>
      [...document.querySelectorAll('.tut-key')]
        .find(el => el.textContent.trim() === label);

    document.addEventListener('keydown', e => {
      if (!this._visible) return;
      const label = KEY_MAP[e.key.toLowerCase()];
      if (!label) return;
      const badge = getBadge(label);
      if (!badge) return;
      // Remove first so re-pressing retriggles the CSS animation.
      badge.classList.remove('pressed');
      void badge.offsetWidth;          // force reflow
      badge.classList.add('pressed');
    });

    document.addEventListener('keyup', e => {
      const label = KEY_MAP[e.key.toLowerCase()];
      if (!label) return;
      getBadge(label)?.classList.remove('pressed');
    });
  }

  // ── HTML injection ─────────────────────────────────────────────────────────

  _inject() {
    document.body.insertAdjacentHTML('beforeend', `
    <div id="screen-tutorial" class="cp-overlay tut-overlay" style="display:none;">

      <div class="tut-panel">

        <!-- Header -->
        <div class="tut-header">
          <div class="tut-eyebrow">NETRUNNER CORP · PILOT MANUAL</div>
          <div class="tut-title">HOW TO FLY</div>
          <div class="tut-divider"></div>
        </div>

        <!-- Two-column control grid -->
        <div class="tut-grid">

          <!-- ── Column 1: Movement ── -->
          <div class="tut-section">
            <div class="tut-section-title">MOVEMENT</div>

            <div class="tut-row">
              <div class="tut-keys">
                <span class="tut-key">A</span>
              </div>
              <span class="tut-desc">Pitch forward / accelerate</span>
            </div>

            <div class="tut-row">
              <div class="tut-keys">
                <span class="tut-key">D</span>
              </div>
              <span class="tut-desc">Pitch back / brake</span>
            </div>

            <div class="tut-row">
              <div class="tut-keys">
                <span class="tut-key">w</span>
                <span class="tut-sep">/</span>
                <span class="tut-key">s</span>
              </div>
              <span class="tut-desc">Roll left / right</span>
            </div>

            <div class="tut-row">
              <div class="tut-keys">
                <span class="tut-key">←</span>
                <span class="tut-sep">/</span>
                <span class="tut-key">→</span>
              </div>
              <span class="tut-desc">Yaw (rotate heading)</span>
            </div>

            <div class="tut-row">
              <div class="tut-keys">
                <span class="tut-key">↑</span>
                <span class="tut-sep">/</span>
                <span class="tut-key">↓</span>
              </div>
              <span class="tut-desc">Ascend / descend</span>
            </div>

            <div class="tut-row">
              <div class="tut-keys">
                <span class="tut-key">⇧</span>
                <span class="tut-sep">+</span>
                <span class="tut-key">A/W/S/D</span>
              </div>
              <span class="tut-desc">Boost thrust (hold Shift)</span>
            </div>
          </div>

          <!-- ── Column 2: Actions & System ── -->
          <div class="tut-section">
            <div class="tut-section-title">ACTIONS</div>

            <div class="tut-row">
              <div class="tut-keys">
                <span class="tut-key">F</span>
              </div>
              <span class="tut-desc">Pick up / deliver package</span>
            </div>

            <div class="tut-row">
              <div class="tut-keys">
                <span class="tut-key">SPC</span>
              </div>
              <span class="tut-desc">Emergency stabilise</span>
            </div>

            <div class="tut-section-title" style="margin-top:18px;">SYSTEM</div>

            <div class="tut-row">
              <div class="tut-keys">
                <span class="tut-key">P</span>
                <span class="tut-sep">/</span>
                <span class="tut-key">ESC</span>
              </div>
              <span class="tut-desc">Pause game</span>
            </div>

            <div class="tut-row">
              <div class="tut-keys">
                <span class="tut-key">H</span>
              </div>
              <span class="tut-desc">Toggle this help panel</span>
            </div>
          </div>
        </div>

        <!-- Tips strip -->
        <div class="tut-tips">
          <div class="tut-tip">◈ Fly to the <span class="hi-cyan">CYAN marker</span> to pick up your package.</div>
          <div class="tut-tip">◈ Deliver to the <span class="hi-pink">PINK marker</span> before the timer expires.</div>
          <div class="tut-tip">◈ Avoid collisions — each hit damages your drone.</div>
        </div>

        <!-- Close button -->
        <button class="cyber-btn cyan-btn tut-close-btn" id="btn-tutorial-close">
          <span class="btn-icon">▶</span> START MISSION
        </button>

      </div><!-- /tut-panel -->
    </div><!-- /screen-tutorial -->
    `);

    document.getElementById('btn-tutorial-close').addEventListener('click', () => {
      this.hide();
      if (this._closeCb) this._closeCb();
    });
  }

  // ── Styles ─────────────────────────────────────────────────────────────────

  _injectStyles() {
    const s = document.createElement('style');
    s.textContent = `
      /* ── Tutorial overlay (re-uses .cp-overlay from ScreenManager) ── */
      .tut-overlay {
        align-items: center;
        justify-content: center;
        z-index: 1100; /* above main menu */
      }

      /* ── Centre panel ── */
      .tut-panel {
        width: min(680px, 94vw);
        border: 1px solid #00ffcc33;
        box-shadow: 0 0 80px #00ffcc18, inset 0 0 60px rgba(0,0,20,0.9);
        padding: 48px 52px 40px;
        display: flex;
        flex-direction: column;
        gap: 24px;
        position: relative;
        z-index: 2;
        background: rgba(0, 5, 9, 0.96);
      }

      /* ── Header ── */
      .tut-eyebrow {
        font-size: 9px; letter-spacing: 4px; color: #00ffcc44; margin-bottom: 8px;
      }
      .tut-title {
        font-size: 30px; font-weight: 900; letter-spacing: 6px; color: #00ffcc;
        text-shadow: 0 0 30px #00ffcc, 0 0 60px #00ffcc44;
      }
      .tut-divider {
        height: 1px; width: 100%;
        background: linear-gradient(90deg, #00ffcc44, transparent);
        margin-top: 18px;
      }

      /* ── Two-column grid ── */
      .tut-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 32px 48px;
      }

      /* ── Section ── */
      .tut-section { display: flex; flex-direction: column; gap: 10px; }
      .tut-section-title {
        font-size: 9px; letter-spacing: 4px; color: #00ffcc66;
        padding-bottom: 8px;
        border-bottom: 1px solid #00ffcc18;
      }

      /* ── Control row ── */
      .tut-row {
        display: flex; align-items: center; gap: 12px;
        font-size: 10px; letter-spacing: 1.5px; color: #aaaacc99;
      }
      .tut-keys {
        display: flex; align-items: center; gap: 4px;
        min-width: 90px; flex-shrink: 0;
      }
      .tut-sep { color: #00ffcc33; font-size: 10px; }
      .tut-desc { color: #aaaacc88; }

      /* ── Key badge ── */
      .tut-key {
        display: inline-flex; align-items: center; justify-content: center;
        min-width: 28px; height: 26px; padding: 0 6px;
        border: 1px solid #00ffcc44;
        border-radius: 3px;
        font-family: 'Share Tech Mono', monospace;
        font-size: 11px; color: #00ffcc;
        background: rgba(0, 255, 204, 0.06);
        box-shadow: 0 0 6px #00ffcc22;
        transition: background 0.1s, box-shadow 0.1s, color 0.1s, border-color 0.1s;
        user-select: none;
      }
      .tut-key.pressed {
        background: rgba(0, 255, 204, 0.28);
        border-color: #00ffcc;
        color: #ffffff;
        box-shadow: 0 0 14px #00ffcc88;
      }

      /* ── Tips strip ── */
      .tut-tips {
        display: flex; flex-direction: column; gap: 6px;
        padding: 16px 20px;
        border: 1px solid #00ffcc0f;
        background: rgba(0,255,204,0.03);
        font-size: 10px; letter-spacing: 1.5px; color: #00ffcc66;
        line-height: 1.8;
      }
      .tut-tip { }
      .hi-cyan { color: #00ffcc; text-shadow: 0 0 8px #00ffcc88; }
      .hi-pink { color: #ff2255; text-shadow: 0 0 8px #ff225566; }

      /* ── Close / start button ── */
      .tut-close-btn {
        align-self: flex-start;
        padding: 13px 36px !important;
        font-size: 12px !important;
        letter-spacing: 5px !important;
      }
    `;
    document.head.appendChild(s);
  }
}