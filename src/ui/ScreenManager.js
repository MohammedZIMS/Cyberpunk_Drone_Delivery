// src/ui/ScreenManager.js

export class ScreenManager {
  constructor() {
    this._state = 'start';        // 'start', 'playing', 'dead'
    this._pauseDiv = null;
    this._inject();
    this._els = this._getElements();
    this._injectPopupKeyframes();
  }

  _getElements() {
    return {
      // HUD elements (injected by _inject)
      alt:       document.getElementById('hud-alt'),
      speed:     document.getElementById('hud-speed'),
      weather:   document.getElementById('hud-weather'),
      wind:      document.getElementById('hud-wind'),
      hpBar:     document.getElementById('hud-hp-bar'),
      hpVal:     document.getElementById('hud-hp-val'),
      score:     document.getElementById('hud-score'),
      hi:        document.getElementById('hud-hi'),
      mult:      document.getElementById('hud-mult'),
      streak:    document.getElementById('hud-streak'),
      mission:   document.getElementById('hud-mission'),
      timerBar:  document.getElementById('hud-timer-bar'),
      timerVal:  document.getElementById('hud-timer'),
      // Screens
      screenStart: document.getElementById('screen-start'),
      screenDead:  document.getElementById('screen-dead'),
      hudMain:     document.getElementById('hud-main'),
      popupLayer:  document.getElementById('popup-layer'),
      // Start screen elements
      ssHi:        document.getElementById('ss-hi'),
      // Dead screen elements
      deadScore:    document.getElementById('dead-score'),
      deadDeliveries: document.getElementById('dead-deliveries'),
      deadHi:       document.getElementById('dead-hi'),
    };
  }

  // ─────────────────────────────────────────────
  // Start screen
  // ─────────────────────────────────────────────
  showStart(highScore) {
    this._set(this._els.ssHi, highScore);
    this._els.screenStart.style.display = 'flex';
    this._els.screenDead.style.display  = 'none';
    this._els.hudMain.style.display     = 'none';
    this._state = 'start';
  }

  onStartClick(fn) {
    const btn = document.getElementById('btn-start');
    if (btn) btn.addEventListener('click', fn, { once: true });
  }

  startPlaying() {
    this._els.screenStart.style.display = 'none';
    this._els.screenDead.style.display  = 'none';
    this._els.hudMain.style.display     = 'block';
    this._state = 'playing';
  }

  // ─────────────────────────────────────────────
  // Death screen
  // ─────────────────────────────────────────────
  showDead(score, deliveries, highScore) {
    this._set(this._els.deadScore,      score);
    this._set(this._els.deadDeliveries, deliveries);
    this._set(this._els.deadHi,         highScore);
    this._els.screenDead.style.display = 'flex';
    this._els.hudMain.style.display    = 'none';
    this._state = 'dead';
  }

  onRestartClick(fn) {
    const btn = document.getElementById('btn-restart');
    if (btn) btn.addEventListener('click', fn, { once: true });
  }

  // ─────────────────────────────────────────────
  // HUD update (called every frame)
  // ─────────────────────────────────────────────
  updateHUD(data) {
    if (this._state !== 'playing') return;

    this._set(this._els.alt,     data.alt.toFixed(1));
    this._set(this._els.speed,   (data.speed * 3.6).toFixed(0)); // m/s → km/h
    this._set(this._els.weather, data.weather);
    this._set(this._els.wind,    data.wind.toFixed(1));

    // Health bar width & colour
    if (this._els.hpBar) {
      const hpPercent = (data.hp / 100) * 80; // max width = 80px
      this._els.hpBar.style.width = Math.min(80, Math.max(0, hpPercent)) + 'px';
      this._els.hpBar.style.background =
        data.hp > 50 ? '#00ffcc' : data.hp > 25 ? '#ffaa00' : '#ff2244';
    }
    this._set(this._els.hpVal, Math.floor(data.hp));

    // Score & stats
    this._set(this._els.score,  data.score);
    this._set(this._els.hi,     data.highScore);
    const mults = [1, 1.2, 1.5, 2.0, 3.0];
    const multIdx = Math.min(data.streak, mults.length - 1);
    this._set(this._els.mult,   mults[multIdx].toFixed(1));
    this._set(this._els.streak, data.streak);

    // Mission text
    const texts = {
      idle:    '…',
      pickup:  'FLY TO ▲ GREEN ZONE TO PICK UP',
      transit: 'DELIVER TO ● ORANGE ZONE',
      done:    '✓ DELIVERED!',
    };
    this._set(this._els.mission, texts[data.mission] || '');

    // Timer bar & value
    const frac = Math.min(data.timeRemaining / 60, 1);
    if (this._els.timerBar) {
      this._els.timerBar.style.width = (frac * 200).toFixed(1) + 'px';
      this._els.timerBar.style.background =
        frac > 0.4 ? '#00ffcc' : frac > 0.2 ? '#ffaa00' : '#ff2244';
    }
    this._set(this._els.timerVal, Math.ceil(data.timeRemaining) + 's');
  }

  // ─────────────────────────────────────────────
  // Score popup
  // ─────────────────────────────────────────────
  showScorePopup(earned, details = {}) {
    const div = document.createElement('div');
    div.className = 'score-popup';
    div.style.cssText = `
      position: absolute;
      left: 50%;
      top: 38%;
      transform: translateX(-50%);
      color: #00ffcc;
      font-size: 26px;
      font-family: monospace;
      text-align: center;
      pointer-events: none;
      text-shadow: 0 0 16px #00ffcc;
      animation: popFade 1.9s ease-out forwards;
      z-index: 200;
    `;
    let html = `+${earned}`;
    if (details.stormBonus > 0) {
      html += `<br><span style="font-size:13px;color:#ffaa00">⚡ STORM BONUS +${details.stormBonus}</span>`;
    }
    if (details.mult > 1) {
      html += `<br><span style="font-size:13px;color:#ff88ff">× ${details.mult.toFixed(1)} STREAK</span>`;
    }
    div.innerHTML = html;
    this._els.popupLayer.appendChild(div);
    setTimeout(() => div.remove(), 2000);
  }

  // ─────────────────────────────────────────────
  // Pause menu
  // ─────────────────────────────────────────────
  showPauseMenu(onResume, onRestart) {
    if (this._pauseDiv) return;
    const div = document.createElement('div');
    div.id = 'pause-overlay';
    div.style.cssText = `
      position: fixed; inset: 0;
      background: rgba(0,0,0,0.85);
      backdrop-filter: blur(12px);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      font-family: 'Orbitron', monospace;
    `;
    div.innerHTML = `
      <div style="font-size:54px; color:#00ffcc; text-shadow:0 0 40px #00ffcc; margin-bottom:40px;">PAUSED</div>
      <button id="resume-pause" style="background:transparent; border:1px solid #00ffcc; color:#00ffcc; padding:12px 40px; margin:10px; cursor:pointer; font-family:inherit;">RESUME</button>
      <button id="restart-pause" style="background:transparent; border:1px solid #ff2255; color:#ff2255; padding:12px 40px; margin:10px; cursor:pointer; font-family:inherit;">RESTART MISSION</button>
      <button id="mainmenu-pause" style="background:transparent; border:1px solid #ffffff44; color:#ffffffaa; padding:12px 40px; margin:10px; cursor:pointer; font-family:inherit;">MAIN MENU</button>
    `;
    document.body.appendChild(div);
    this._pauseDiv = div;

    document.getElementById('resume-pause').onclick = () => {
      this.hidePauseMenu();
      onResume();
    };
    document.getElementById('restart-pause').onclick = () => {
      this.hidePauseMenu();
      onRestart();
    };
    document.getElementById('mainmenu-pause').onclick = () => {
      location.reload();
    };
  }

  hidePauseMenu() {
    if (this._pauseDiv) {
      this._pauseDiv.remove();
      this._pauseDiv = null;
    }
  }

  // ─────────────────────────────────────────────
  // Flash effect (external call)
  // ─────────────────────────────────────────────
  flashHit() {
    const flash = document.getElementById('hit-flash');
    if (flash) {
      flash.style.background = '#ff000055';
      setTimeout(() => { flash.style.background = '#ff000000'; }, 80);
    }
  }

  // ─────────────────────────────────────────────
  // DOM injection – builds all UI dynamically
  // ─────────────────────────────────────────────
  _inject() {
    document.body.insertAdjacentHTML('beforeend', `
      <!-- Start Screen -->
      <div id="screen-start" style="
        position:fixed; inset:0;
        background:rgba(2,0,10,0.93);
        display:flex; flex-direction:column;
        align-items:center; justify-content:center;
        font-family:'Courier New',monospace;
        color:#00ffcc; z-index:100;
        backdrop-filter:blur(4px);">
        <div style="font-size:13px; letter-spacing:8px; color:#444; margin-bottom:6px;">ANTHROPIC GRAPHICS LAB</div>
        <div style="font-size:42px; letter-spacing:6px; font-weight:700; margin-bottom:4px; text-shadow:0 0 30px #00ffcc;">▲ DRONE.EXE</div>
        <div style="font-size:12px; letter-spacing:5px; color:#888; margin-bottom:48px;">CYBERPUNK DELIVERY SIMULATOR</div>
        <div style="font-size:11px; color:#555; margin-bottom:6px;">W A S D · FLY &nbsp;&nbsp; ↑ ↓ · ALTITUDE &nbsp;&nbsp; ← → · ROTATE</div>
        <div style="font-size:11px; color:#555; margin-bottom:44px;">SPACE · EMERGENCY HOVER &nbsp;&nbsp; GREEN ZONE · COLLECT PACKAGE</div>
        <button id="btn-start" style="background:transparent; border:1px solid #00ffcc; color:#00ffcc; font-family:'Courier New',monospace; font-size:17px; letter-spacing:5px; padding:14px 52px; cursor:pointer; transition:all 0.2s;">[ LAUNCH ]</button>
        <div style="margin-top:24px; font-size:11px; color:#333;">ALL-TIME BEST &nbsp; <span id="ss-hi" style="color:#555;">0</span></div>
      </div>

      <!-- In-game HUD -->
      <div id="hud-main" style="display:none; position:fixed; inset:0; pointer-events:none; z-index:10; font-family:'Courier New',monospace;">
        <div style="position:absolute; top:20px; left:20px; color:#00ffcc; font-size:12px; line-height:2.0; text-shadow:0 0 6px #00ffcc66;">
          <div>ALT &nbsp;<span id="hud-alt" style="color:#fff;">0</span> m &nbsp;&nbsp; SPD &nbsp;<span id="hud-speed" style="color:#fff;">0</span> km/h</div>
          <div><span id="hud-weather">CLEAR</span> &nbsp;&nbsp; WIND &nbsp;<span id="hud-wind" style="color:#fff;">0.0</span> m/s</div>
          <div style="margin-top:4px;">HP <span id="hud-hp-bar" style="display:inline-block; width:80px; height:7px; background:#00ffcc; vertical-align:middle; border:1px solid #00ffcc33; margin:0 6px; transition:background 0.3s, width 0.1s;"></span><span id="hud-hp-val" style="color:#fff;">100</span></div>
        </div>
        <div style="position:absolute; top:20px; right:20px; color:#00ffcc; font-size:12px; text-align:right; line-height:2.0; text-shadow:0 0 6px #00ffcc66;">
          <div>SCORE &nbsp;<span id="hud-score" style="color:#fff;font-size:16px;">0</span></div>
          <div>BEST &nbsp;&nbsp;<span id="hud-hi" style="color:#555;">0</span></div>
          <div>×<span id="hud-mult" style="color:#ff88ff;">1.0</span> &nbsp; STREAK &nbsp; <span id="hud-streak" style="color:#fff;">0</span></div>
        </div>
        <div style="position:absolute; bottom:32px; left:50%; transform:translateX(-50%); text-align:center; color:#00ffcc; font-size:11px; line-height:2.0; text-shadow:0 0 6px #00ffcc66;">
          <div id="hud-mission">HEAD TO GREEN ZONE</div>
          <div><span id="hud-timer-bar" style="display:inline-block; width:200px; height:3px; background:#00ffcc; vertical-align:middle; transition:background 0.3s;"></span><span id="hud-timer" style="color:#fff; margin-left:8px;">60s</span></div>
        </div>
      </div>

      <!-- Popup layer for floating scores -->
      <div id="popup-layer" style="position:fixed; inset:0; pointer-events:none; z-index:20;"></div>

      <!-- Death Screen -->
      <div id="screen-dead" style="
        position:fixed; inset:0;
        background:rgba(10,0,2,0.90);
        display:none; flex-direction:column;
        align-items:center; justify-content:center;
        font-family:'Courier New',monospace;
        color:#ff2244; z-index:100;
        backdrop-filter:blur(4px);">
        <div style="font-size:38px; letter-spacing:4px; font-weight:700; margin-bottom:10px; text-shadow:0 0 30px #ff2244;">DRONE DESTROYED</div>
        <div style="font-size:13px; color:#888; margin-bottom:8px;">FINAL SCORE &nbsp; <span id="dead-score" style="color:#fff;font-size:18px;">0</span></div>
        <div style="font-size:11px; color:#555; margin-bottom:36px;">DELIVERIES &nbsp; <span id="dead-deliveries" style="color:#888;">0</span> &nbsp;·&nbsp; BEST &nbsp; <span id="dead-hi" style="color:#888;">0</span></div>
        <button id="btn-restart" style="background:transparent; border:1px solid #ff2244; color:#ff2244; font-family:'Courier New',monospace; font-size:16px; letter-spacing:4px; padding:12px 44px; cursor:pointer;">[ RESTART ]</button>
      </div>
    `);

    // Button hover effects
    ['btn-start', 'btn-restart'].forEach(id => {
      const btn = document.getElementById(id);
      if (btn) {
        btn.addEventListener('mouseenter', () => { btn.style.background = '#ffffff22'; btn.style.letterSpacing = '6px'; });
        btn.addEventListener('mouseleave', () => { btn.style.background = 'transparent'; btn.style.letterSpacing = '4px'; });
      }
    });
  }

  _injectPopupKeyframes() {
    if (document.getElementById('screen-manager-styles')) return;
    const style = document.createElement('style');
    style.id = 'screen-manager-styles';
    style.textContent = `
      @keyframes popFade {
        0%   { opacity:1; transform:translateX(-50%) translateY(0px); }
        70%  { opacity:1; transform:translateX(-50%) translateY(-40px); }
        100% { opacity:0; transform:translateX(-50%) translateY(-70px); }
      }
    `;
    document.head.appendChild(style);
  }

  _set(el, val) { if (el) el.textContent = val; }
}