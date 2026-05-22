export class ScreenManager {
  constructor() {
    this._state = 'start'; // 'start' | 'playing' | 'paused' | 'dead'
    this._inject();
    this._cacheElements();
    this._injectStyles();
  }

  // ── Element cache ─────────────────────────────────────────────────────────

  _cacheElements() {
    const $ = id => document.getElementById(id);
    this._els = {
      hud:            $('hud'),
      alt:            $('hud-alt'),
      hpBar:          $('hp-bar'),
      hpVal:          $('hud-hp'),
      weather:        $('hud-weather'),
      wind:           $('hud-wind'),
      score:          $('score-val'),
      speed:          $('speed-val'),
      pkg:            $('pkg-text'),
      timerPanel:     $('timer-panel'),
      timerVal:       $('timer-val'),
      compassTape:    $('compass-tape'),
      hitFlash:       $('hit-flash'),
      start:          $('screen-start'),
      dead:           $('screen-dead'),
      pause:          $('screen-pause'),
      startBtn:       $('btn-start'),
      restartBtn:     $('btn-restart'),
      resumeBtn:      $('btn-resume'),
      pauseRestartBtn:$('btn-pause-restart'),
      mainMenuBtn:    $('btn-main-menu'),
      ssHi:           $('ss-hi'),
      deadScore:      $('dead-score'),
      deadDeliveries: $('dead-deliveries'),
      deadHi:         $('dead-hi'),
      popupLayer:     $('popup-layer'),
    };
  }

  // ── State transitions ─────────────────────────────────────────────────────

  showStart(highScore) {
    this._els.ssHi.textContent        = highScore;
    this._els.start.style.display     = 'flex';
    this._els.dead.style.display      = 'none';
    this._els.pause.style.display     = 'none';
    this._els.hud.style.display       = 'none';
    this._state = 'start';
  }

  onStartClick(fn) {
    this._els.startBtn.addEventListener('click', fn, { once: true });
  }

  startPlaying() {
    this._els.start.style.display  = 'none';
    this._els.dead.style.display   = 'none';
    this._els.pause.style.display  = 'none';
    this._els.hud.style.display    = 'block';
    this._state = 'playing';
  }

  showPause() {
    this._els.pause.style.display = 'flex';
    this._state = 'paused';
    // HUD stays visible behind the blur overlay
  }

  hidePause() {
    this._els.pause.style.display = 'none';
    this._state = 'playing';
  }

  /**
   * Wire up pause-menu buttons.
   * Called once from main.js so callbacks hold the correct closure references.
   */
  bindPauseButtons({ onResume, onRestart, onMainMenu }) {
    this._els.resumeBtn.addEventListener('click', onResume);
    this._els.pauseRestartBtn.addEventListener('click', onRestart);
    this._els.mainMenuBtn.addEventListener('click', onMainMenu);
  }

  showDead(score, deliveries, highScore) {
    this._els.deadScore.textContent      = score;
    this._els.deadDeliveries.textContent = deliveries;
    this._els.deadHi.textContent         = highScore;

    // FIX: clone the button to strip all previous 'once' listeners so the
    // Nth restart doesn't fire N callbacks
    const oldBtn = this._els.restartBtn;
    const newBtn = oldBtn.cloneNode(true);
    oldBtn.parentNode.replaceChild(newBtn, oldBtn);
    this._els.restartBtn = newBtn;

    this._els.dead.style.display  = 'flex';
    this._els.pause.style.display = 'none';
    this._state = 'dead';
  }

  onRestartClick(fn) {
    this._els.restartBtn.addEventListener('click', fn, { once: true });
  }

  // ── HUD update ────────────────────────────────────────────────────────────

  /**
   * FIX: accepts 'playing' AND 'paused' — the pause screen renders over the
   * top, but the HUD data beneath it must remain current so it looks right
   * when the game resumes.
   */
  updateHUD(data) {
    if (this._state !== 'playing' && this._state !== 'paused') return;

    const safe = (v, fallback = 0) =>
      (v !== null && v !== undefined && isFinite(v)) ? v : fallback;

    this._set('alt',   safe(data.alt).toFixed(0));
    this._set('speed', (safe(data.speed) * 3.6).toFixed(0));
    this._set('weather', data.weather || 'CLEAR');
    this._set('wind',  safe(data.wind).toFixed(1) + ' m/s');
    this._set('score', safe(data.score));

    // HP bar
    const hp = Math.max(0, Math.min(100, safe(data.hp, 100)));
    if (this._els.hpVal)  this._els.hpVal.textContent = Math.ceil(hp);
    if (this._els.hpBar) {
      this._els.hpBar.style.width = hp + '%';
      this._els.hpBar.style.background =
        hp > 60 ? 'linear-gradient(90deg,#00ffcc,#00ff88)' :
        hp > 30 ? 'linear-gradient(90deg,#ffaa00,#ff6600)' :
                  'linear-gradient(90deg,#ff0044,#ff0000)';
    }

    // Timer
    if (this._els.timerPanel) this._els.timerPanel.style.display = 'block';
    this._set('timerVal', Math.ceil(safe(data.timeRemaining, 90)));

    // Package status
    const PKG = { idle:'NO PACKAGE', pickup:'PICKUP TARGET',
                  transit:'DELIVER PACKAGE', done:'DELIVERY COMPLETE' };
    this._set('pkg', PKG[data.mission] || 'ACTIVE');

    // FIX: compass — updated every frame unconditionally, no longer gated
    // behind a delivery event so it never stops rotating
    if (this._els.compassTape && typeof data.yaw === 'number' && isFinite(data.yaw)) {
      const offset = -(data.yaw * 180 / Math.PI) * 4;
      this._els.compassTape.style.left = offset + 'px';
    }
  }

  // ── Visual effects ────────────────────────────────────────────────────────

  flashHit() {
    if (!this._els.hitFlash) return;
    this._els.hitFlash.style.background = '#ff000055';
    setTimeout(() => {
      if (this._els.hitFlash) this._els.hitFlash.style.background = 'transparent';
    }, 80);
  }

  showScorePopup(points) {
    const div = document.createElement('div');
    div.className = 'score-popup';
    div.style.cssText = `
      position:absolute; left:50%; top:40%;
      transform:translate(-50%,-50%);
      color:#00ffcc; font-size:32px;
      font-family:Orbitron,monospace;
      text-shadow:0 0 20px #00ffcc;
      pointer-events:none;
      animation:popFade 1.5s ease-out forwards;
    `;
    div.textContent = '+' + points;
    this._els.popupLayer.appendChild(div);
    setTimeout(() => div.remove(), 1500);
  }

  // ── Internal helpers ──────────────────────────────────────────────────────

  _set(key, value) {
    const el = this._els[key];
    if (el) el.textContent = value;
  }

  // ── HTML injection ────────────────────────────────────────────────────────

  _inject() {
    document.body.insertAdjacentHTML('beforeend', `

      <!-- ── Popup layer ── -->
      <div id="popup-layer"
        style="position:fixed;inset:0;pointer-events:none;z-index:999;">
      </div>

      <!-- ── START SCREEN ── -->
      <div id="screen-start" style="
        position:fixed;inset:0;background:#000000ee;
        display:flex;flex-direction:column;align-items:center;
        justify-content:center;z-index:1000;
        font-family:Orbitron,monospace;color:#00ffcc;">
        <div style="font-size:54px;margin-bottom:20px;text-shadow:0 0 40px #00ffcc;">
          DRONE.EXE
        </div>
        <div style="letter-spacing:4px;margin-bottom:16px;color:#00ffcc88;">
          CYBERPUNK DELIVERY SIMULATOR
        </div>
        <div style="font-size:11px;color:#00ffcc55;margin-bottom:40px;letter-spacing:2px;">
          W A S D · ARROWS · SPACE · ESC/P = PAUSE
        </div>
        <button id="btn-start" class="cyber-btn cyan-btn" style="font-size:14px;padding:15px 48px;">
          START MISSION
        </button>
        <div style="margin-top:30px;color:#00ffcc66;font-size:12px;">
          HIGH SCORE: <span id="ss-hi">0</span>
        </div>
      </div>

      <!-- ── PAUSE SCREEN ── -->
      <div id="screen-pause" style="
        position:fixed;inset:0;
        background:rgba(0,0,16,0.82);
        backdrop-filter:blur(6px);
        -webkit-backdrop-filter:blur(6px);
        display:none;flex-direction:column;
        align-items:center;justify-content:center;
        z-index:900;font-family:Orbitron,monospace;">

        <!-- Neon border panel -->
        <div style="
          border:1px solid #00ffcc44;
          box-shadow:0 0 60px #00ffcc22,inset 0 0 60px rgba(0,0,20,0.9);
          padding:60px 80px;text-align:center;
          min-width:360px;">

          <div style="font-size:11px;letter-spacing:6px;color:#00ffcc66;margin-bottom:8px;">
            SYSTEM
          </div>
          <div style="font-size:36px;letter-spacing:8px;color:#00ffcc;
            text-shadow:0 0 30px #00ffcc,0 0 60px #00ffcc44;margin-bottom:48px;">
            PAUSED
          </div>

          <!-- Decorative line -->
          <div style="height:1px;background:linear-gradient(90deg,transparent,#00ffcc44,transparent);
            margin-bottom:40px;"></div>

          <div style="display:flex;flex-direction:column;gap:16px;align-items:center;">
            <button id="btn-resume"         class="cyber-btn cyan-btn"   style="width:240px;">RESUME</button>
            <button id="btn-pause-restart"  class="cyber-btn amber-btn"  style="width:240px;">RESTART MISSION</button>
            <button id="btn-main-menu"      class="cyber-btn ghost-btn"  style="width:240px;">MAIN MENU</button>
          </div>

          <div style="margin-top:40px;font-size:10px;color:#00ffcc33;letter-spacing:3px;">
            ESC · P  TO RESUME
          </div>
        </div>
      </div>

      <!-- ── GAME OVER SCREEN ── -->
      <div id="screen-dead" style="
        position:fixed;inset:0;background:#000000ee;
        display:none;flex-direction:column;
        align-items:center;justify-content:center;
        z-index:1000;font-family:Orbitron,monospace;color:#ff2255;">
        <div style="font-size:42px;margin-bottom:20px;text-shadow:0 0 40px #ff2255;">
          DRONE DESTROYED
        </div>
        <div style="color:#ffffff88;font-size:13px;margin-bottom:8px;">
          SCORE: <span id="dead-score" style="color:#fff;">0</span>
        </div>
        <div style="color:#ffffff88;font-size:13px;margin-bottom:8px;">
          DELIVERIES: <span id="dead-deliveries" style="color:#fff;">0</span>
        </div>
        <div style="color:#ffffff88;font-size:13px;margin-bottom:36px;">
          BEST: <span id="dead-hi" style="color:#fff;">0</span>
        </div>
        <button id="btn-restart" class="cyber-btn red-btn" style="font-size:14px;padding:15px 48px;">
          RESTART
        </button>
      </div>
    `);
  }

  // ── Shared styles ─────────────────────────────────────────────────────────

  _injectStyles() {
    const s = document.createElement('style');
    s.textContent = `
      /* ── Shared cyberpunk button ── */
      .cyber-btn {
        background: none;
        border: 1px solid currentColor;
        font-family: Orbitron, monospace;
        font-size: 12px;
        letter-spacing: 4px;
        padding: 13px 28px;
        cursor: pointer;
        text-transform: uppercase;
        transition: box-shadow .2s, background .2s;
      }
      .cyber-btn:hover { background: rgba(255,255,255,0.05); }

      .cyan-btn  { color:#00ffcc; border-color:#00ffcc44; }
      .cyan-btn:hover  { box-shadow:0 0 24px #00ffcc44; border-color:#00ffcc; }

      .amber-btn { color:#ffaa00; border-color:#ffaa0044; }
      .amber-btn:hover { box-shadow:0 0 24px #ffaa0044; border-color:#ffaa00; }

      .ghost-btn { color:#aaaacc; border-color:#aaaacc33; }
      .ghost-btn:hover { box-shadow:0 0 16px #aaaacc22; border-color:#aaaacc66; }

      .red-btn   { color:#ff2255; border-color:#ff225544; }
      .red-btn:hover   { box-shadow:0 0 24px #ff225544; border-color:#ff2255; }

      /* ── Score popup ── */
      @keyframes popFade {
        0%   { opacity:1; transform:translate(-50%,-50%); }
        100% { opacity:0; transform:translate(-50%,-130%); }
      }
    `;
    document.head.appendChild(s);
  }
}
