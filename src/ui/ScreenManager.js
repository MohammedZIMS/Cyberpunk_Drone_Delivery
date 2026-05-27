// ══════════════════════════════════════════════════════════════════════════════
//  ScreenManager.js  –  Full Cyberpunk Main Menu + HUD System
//  Screens: Main Menu · Start Mission · Continue · Settings ·
//           Tactical Map · Audio Settings · Exit · Pause · Game Over
// ══════════════════════════════════════════════════════════════════════════════

export class ScreenManager {
  constructor() {
    this._state        = 'mainMenu'; // mainMenu | playing | paused | dead
    this._menuSection  = 'main';     // main | settings | audio | tacticalMap | exitConfirm
    this._gameSpeed    = 1.0;        // gameplay speed multiplier
    this._audioSettings = {
      masterVol : 0.6,
      droneVol  : 1.0,
      rainVol   : 1.0,
      windVol   : 1.0,
      muted     : false,
    };

    this._injectStyles();
    this._inject();
    this._cacheElements();
    this._bindMenuNav();
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Public API — getters
  // ══════════════════════════════════════════════════════════════════════════

  getGameSpeed()     { return this._gameSpeed; }
  getAudioSettings() { return { ...this._audioSettings }; }
  get isMuted()      { return this._audioSettings.muted; }

  // ══════════════════════════════════════════════════════════════════════════
  // State transitions
  // ══════════════════════════════════════════════════════════════════════════

  showMainMenu(highScore) {
    if (highScore !== undefined) this._setEl('mm-hi', highScore);
    this._showSection('main');
    this._els.mainMenu.style.display = 'flex';
    this._els.hud.style.display      = 'none';
    this._els.dead.style.display     = 'none';
    this._els.pause.style.display    = 'none';
    this._state = 'mainMenu';
    this._animateMenuIn();
  }

  // legacy alias used by main.js
  showStart(highScore) { this.showMainMenu(highScore); }

  startPlaying() {
    this._els.mainMenu.style.display = 'none';
    this._els.dead.style.display     = 'none';
    this._els.pause.style.display    = 'none';
    this._els.hud.style.display      = 'block';
    this._state = 'playing';
  }

  showPause() {
    this._els.pause.style.display = 'flex';
    this._state = 'paused';
  }

  hidePause() {
    this._els.pause.style.display = 'none';
    this._state = 'playing';
  }

  showDead(score, deliveries, highScore) {
    this._setEl('dead-score',      score);
    this._setEl('dead-deliveries', deliveries);
    this._setEl('dead-hi',         highScore);

    const oldBtn = this._els.restartBtn;
    const newBtn = oldBtn.cloneNode(true);
    oldBtn.parentNode.replaceChild(newBtn, oldBtn);
    this._els.restartBtn = newBtn;

    this._els.dead.style.display  = 'flex';
    this._els.pause.style.display = 'none';
    this._state = 'dead';
  }

  onStartClick(fn) {
    // Called by main.js — we forward to the Start Mission menu button
    this._startMissionCb = fn;
  }

  onRestartClick(fn) {
    this._els.restartBtn.addEventListener('click', fn, { once: true });
  }

  bindPauseButtons({ onResume, onRestart, onMainMenu }) {
    this._els.resumeBtn?.addEventListener('click', onResume);
    this._els.pauseRestartBtn?.addEventListener('click', onRestart);
    this._els.pauseMainMenuBtn?.addEventListener('click', onMainMenu);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // HUD update
  // ══════════════════════════════════════════════════════════════════════════

  updateHUD(data) {
    if (this._state !== 'playing' && this._state !== 'paused') return;
    const safe = (v, fb = 0) => (v !== null && v !== undefined && isFinite(v)) ? v : fb;

    this._setEl('hud-alt',    safe(data.alt).toFixed(0));
    this._setEl('speed-val',  (safe(data.speed) * 3.6).toFixed(0));
    this._setEl('hud-weather', data.weather || 'CLEAR');
    this._setEl('hud-wind',   safe(data.wind).toFixed(1) + ' m/s');
    this._setEl('score-val',  safe(data.score));

    const hp = Math.max(0, Math.min(100, safe(data.hp, 100)));
    if (this._els.hpVal)  this._els.hpVal.textContent   = Math.ceil(hp);
    if (this._els.hpBar) {
      this._els.hpBar.style.width = hp + '%';
      this._els.hpBar.style.background =
        hp > 60 ? 'linear-gradient(90deg,#00ffcc,#00ff88)' :
        hp > 30 ? 'linear-gradient(90deg,#ffaa00,#ff6600)' :
                  'linear-gradient(90deg,#ff0044,#ff0000)';
    }

    if (this._els.timerPanel) this._els.timerPanel.style.display = 'block';
    this._setEl('timer-val', Math.ceil(safe(data.timeRemaining, 90)));

    const PKG = { idle:'NO PACKAGE', pickup:'PICKUP TARGET', transit:'DELIVER PACKAGE', done:'DELIVERY COMPLETE' };
    this._setEl('pkg-text', PKG[data.mission] || 'ACTIVE');

    // Toggle neon glow on pkg-panel when carrying
    const pkgPanel = document.getElementById('pkg-panel');
    if (pkgPanel) {
      pkgPanel.classList.toggle('pkg-carrying', data.mission === 'transit');
    }

    if (this._els.compassTape && typeof data.yaw === 'number' && isFinite(data.yaw)) {
      this._els.compassTape.style.left = -(data.yaw * 180 / Math.PI) * 4 + 'px';
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Visual FX
  // ══════════════════════════════════════════════════════════════════════════

  flashHit() {
    if (!this._els.hitFlash) return;
    this._els.hitFlash.style.background = '#ff000055';
    setTimeout(() => { if (this._els.hitFlash) this._els.hitFlash.style.background = 'transparent'; }, 80);
  }

  showScorePopup(points) {
    const div = document.createElement('div');
    div.className = 'score-popup';
    div.textContent = '+' + points;
    this._els.popupLayer?.appendChild(div);
    setTimeout(() => div.remove(), 1500);
  }

  /** Pickup-specific popup: neon yellow, bigger, with label */
  showPickupPopup(points, label = 'PACKAGE PICKUP') {
    const div = document.createElement('div');
    div.className = 'score-popup score-popup--pickup';
    div.innerHTML = `<span class="spp-pts">+${points}</span><span class="spp-label">${label}</span>`;
    this._els.popupLayer?.appendChild(div);
    setTimeout(() => div.remove(), 2000);
  }

  /** Flash the score display briefly in neon white */
  flashScore() {
    const el = document.getElementById('score-val');
    if (!el) return;
    el.classList.add('score-flash');
    setTimeout(() => el.classList.remove('score-flash'), 600);
  }

  /** Show a small HUD notification bar (auto-hides) */
  showHUDNotification(text, color = '#ffff00') {
    let notif = document.getElementById('hud-notification');
    if (!notif) {
      notif = document.createElement('div');
      notif.id = 'hud-notification';
      document.getElementById('hud')?.appendChild(notif);
    }
    notif.textContent = text;
    notif.style.color = color;
    notif.style.textShadow = `0 0 12px ${color}`;
    notif.classList.remove('hud-notif-hide');
    notif.classList.add('hud-notif-show');
    clearTimeout(this._notifTimer);
    this._notifTimer = setTimeout(() => {
      notif.classList.remove('hud-notif-show');
      notif.classList.add('hud-notif-hide');
    }, 2500);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Internal — element cache
  // ══════════════════════════════════════════════════════════════════════════

  _cacheElements() {
    const $ = id => document.getElementById(id);
    this._els = {
      // Screens
      mainMenu       : $('screen-main-menu'),
      pause          : $('screen-pause'),
      dead           : $('screen-dead'),
      // HUD
      hud            : $('hud'),
      hpBar          : $('hp-bar'),
      hpVal          : $('hud-hp'),
      timerPanel     : $('timer-panel'),
      compassTape    : $('compass-tape'),
      hitFlash       : $('hit-flash'),
      popupLayer     : $('popup-layer'),
      // Pause buttons
      resumeBtn      : $('btn-resume'),
      pauseRestartBtn: $('btn-pause-restart'),
      pauseMainMenuBtn: $('btn-pause-main-menu'),
      // Dead screen
      restartBtn     : $('btn-restart'),
    };
  }

  _setEl(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Menu navigation
  // ══════════════════════════════════════════════════════════════════════════

  _showSection(name) {
    this._menuSection = name;
    document.querySelectorAll('.mm-section').forEach(el => {
      el.style.display = el.dataset.section === name ? 'flex' : 'none';
    });
  }

  _animateMenuIn() {
    document.querySelectorAll('.mm-item').forEach((el, i) => {
      el.style.opacity   = '0';
      el.style.transform = 'translateX(-30px)';
      setTimeout(() => {
        el.style.transition = 'opacity 0.35s ease, transform 0.35s ease';
        el.style.opacity    = '1';
        el.style.transform  = 'translateX(0)';
      }, 80 + i * 60);
    });
  }

  _bindMenuNav() {
    // Delegated click handling for all menu sections
    document.addEventListener('click', e => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      this._handleAction(btn.dataset.action, btn);
    });

    // Audio sliders
    document.addEventListener('input', e => {
      const el = e.target;
      if (!el.dataset.audioParam) return;
      const param = el.dataset.audioParam;
      const val   = parseFloat(el.value);
      this._audioSettings[param] = val;
      const pct = document.getElementById('val-' + param);
      if (pct) pct.textContent = Math.round(val * 100) + '%';
      this._notifyAudioChange();
    });
  }

  _handleAction(action, btn) {
    switch (action) {
      case 'start-mission':
        if (this._startMissionCb) {
          this._startMissionCb();
          this._startMissionCb = null; // consumed; re-set by main.js each session
        }
        break;

      case 'open-tutorial':
        if (this._tutorialCb) this._tutorialCb();
        break;

      case 'open-settings':
        this._showSection('settings');
        break;

      case 'open-audio':
        this._updateAudioPanel();
        this._showSection('audio');
        break;

      case 'open-tactical':
        this._showSection('tactical');
        break;

      case 'open-exit':
        this._showSection('exit');
        break;

      case 'back-to-main':
        this._showSection('main');
        this._animateMenuIn();
        break;

      case 'toggle-mute': {
        this._audioSettings.muted = !this._audioSettings.muted;
        btn.textContent = this._audioSettings.muted ? '▶  UNMUTE AUDIO' : '🔇  MUTE AUDIO';
        btn.classList.toggle('amber-btn', this._audioSettings.muted);
        btn.classList.toggle('cyan-btn',  !this._audioSettings.muted);
        this._notifyAudioChange();
        break;
      }

      case 'speed-slow':
      case 'speed-normal':
      case 'speed-fast': {
        const speeds = { 'speed-slow': 0.5, 'speed-normal': 1.0, 'speed-fast': 1.5 };
        this._gameSpeed = speeds[action];
        document.querySelectorAll('[data-action^="speed-"]').forEach(b => {
          b.classList.toggle('cyan-btn',  b.dataset.action === action);
          b.classList.toggle('ghost-btn', b.dataset.action !== action);
        });
        this._notifySpeedChange();
        break;
      }

      case 'confirm-exit':
        // In browser context: redirect or close tab gracefully
        document.body.innerHTML = `
          <div style="position:fixed;inset:0;background:#000;display:flex;align-items:center;
            justify-content:center;font-family:Orbitron,monospace;color:#00ffcc;font-size:22px;
            letter-spacing:4px;text-shadow:0 0 30px #00ffcc;">
            CONNECTION TERMINATED
          </div>`;
        setTimeout(() => { try { window.close(); } catch(e) {} }, 1800);
        break;

      case 'cancel-exit':
        this._showSection('main');
        this._animateMenuIn();
        break;

      // Pause screen
      case 'pause-resume':
        if (this._pauseResumeCb) this._pauseResumeCb();
        break;
      case 'pause-restart':
        if (this._pauseRestartCb) this._pauseRestartCb();
        break;
      case 'pause-main-menu':
        if (this._pauseMainMenuCb) this._pauseMainMenuCb();
        break;
    }
  }

  // Allow main.js to register tutorial callback
  onTutorial(fn)      { this._tutorialCb = fn; }
  onSpeedChange(fn)   { this._speedChangeCb = fn; }
  onAudioChange(fn)   { this._audioChangeCb = fn; }

  _notifySpeedChange() {
    if (this._speedChangeCb) this._speedChangeCb(this._gameSpeed);
  }

  _notifyAudioChange() {
    if (this._audioChangeCb) this._audioChangeCb(this.getAudioSettings());
  }

  _updateAudioPanel() {
    const a = this._audioSettings;
    const sliders = ['masterVol','droneVol','rainVol','windVol'];
    sliders.forEach(p => {
      const sl = document.getElementById('sl-' + p);
      const vl = document.getElementById('val-' + p);
      if (sl) sl.value = a[p];
      if (vl) vl.textContent = Math.round(a[p] * 100) + '%';
    });
    const muteBtn = document.getElementById('btn-toggle-mute');
    if (muteBtn) {
      muteBtn.textContent = a.muted ? '▶  UNMUTE AUDIO' : '🔇  MUTE AUDIO';
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // HTML injection
  // ══════════════════════════════════════════════════════════════════════════

  _inject() {
    document.body.insertAdjacentHTML('beforeend', `

    <!-- ════════════════════════════════════ POPUP LAYER ═══════════════════ -->
    <div id="popup-layer" style="position:fixed;inset:0;pointer-events:none;z-index:999;"></div>

    <!-- ════════════════════════════════════ MAIN MENU ════════════════════ -->
    <div id="screen-main-menu" class="cp-overlay" style="display:flex;">

      <!-- Left gutter — decorative vertical lines -->
      <div class="mm-gutter">
        <div class="mm-vert-line" style="left:12px;"></div>
        <div class="mm-vert-line" style="left:28px;animation-delay:-.4s;"></div>
        <div class="mm-scan-bar"></div>
      </div>

      <!-- Centre panel -->
      <div class="mm-center">

        <!-- Logo block -->
        <div class="mm-logo-block">
          <div class="mm-eyebrow">NETRUNNER CORP · LOGISTICS DIV</div>
          <div class="mm-logo">DRONE<span class="mm-logo-accent">.EXE</span></div>
          <div class="mm-sub">CYBERPUNK DELIVERY SIMULATOR</div>
          <div class="mm-divider"></div>
        </div>

        <!-- ── SECTION: main ──────────────────────────────────────── -->
        <div class="mm-section" data-section="main" style="display:flex;flex-direction:column;gap:10px;width:100%;">
          <button class="cyber-btn cyan-btn mm-item" data-action="start-mission">
            <span class="btn-icon">▶</span> START MISSION
          </button>
          <button class="cyber-btn ghost-btn mm-item" data-action="open-tutorial">
            <span class="btn-icon">?</span> TUTORIAL
          </button>
          <button class="cyber-btn ghost-btn mm-item" data-action="open-settings">
            <span class="btn-icon">⚙</span> SETTINGS
          </button>
          <button class="cyber-btn ghost-btn mm-item" data-action="open-tactical">
            <span class="btn-icon">◈</span> TACTICAL MAP
          </button>
          <button class="cyber-btn ghost-btn mm-item" data-action="open-audio">
            <span class="btn-icon">♪</span> AUDIO SETTINGS
          </button>
          <button class="cyber-btn red-btn mm-item" data-action="open-exit">
            <span class="btn-icon">✕</span> EXIT GAME
          </button>
          <div class="mm-footer-stat">HIGH SCORE: <span id="mm-hi">0</span></div>
        </div>

        <!-- ── SECTION: settings ──────────────────────────────────── -->
        <div class="mm-section" data-section="settings" style="display:none;flex-direction:column;gap:14px;width:100%;">
          <div class="mm-section-title">⚙  SETTINGS</div>

          <div class="mm-setting-row">
            <span class="mm-setting-label">GAMEPLAY SPEED</span>
            <div class="mm-btn-group">
              <button class="cyber-btn ghost-btn mm-speed-btn" data-action="speed-slow">0.5×</button>
              <button class="cyber-btn cyan-btn  mm-speed-btn" data-action="speed-normal">1.0×</button>
              <button class="cyber-btn ghost-btn mm-speed-btn" data-action="speed-fast">1.5×</button>
            </div>
          </div>

          <div class="mm-setting-row">
            <span class="mm-setting-label">HUD OPACITY</span>
            <div style="display:flex;align-items:center;gap:10px;">
              <input type="range" min="0.3" max="1" step="0.05" value="1" id="sl-hudOpacity"
                style="width:120px;" oninput="document.getElementById('val-hudOpacity').textContent=Math.round(this.value*100)+'%';
                document.getElementById('hud').style.opacity=this.value;">
              <span id="val-hudOpacity" class="mm-val-badge">100%</span>
            </div>
          </div>

          <div class="mm-setting-row">
            <span class="mm-setting-label">COMPASS</span>
            <button class="cyber-btn cyan-btn mm-toggle-btn" id="btn-compass-toggle"
              onclick="const c=document.getElementById('compass-tape');if(c){const on=c.style.display!=='none';c.style.display=on?'none':'block';this.textContent=on?'OFF':'ON';}">ON</button>
          </div>

          <div class="mm-setting-row">
            <span class="mm-setting-label">RAIN PARTICLES</span>
            <button class="cyber-btn cyan-btn mm-toggle-btn" id="btn-rain-toggle" onclick="this.dataset.on=this.dataset.on==='0'?'1':'0';this.textContent=this.dataset.on==='0'?'OFF':'ON';" data-on="1">ON</button>
          </div>

          <button class="cyber-btn ghost-btn" data-action="back-to-main" style="margin-top:8px;">← BACK</button>
        </div>

        <!-- ── SECTION: audio ─────────────────────────────────────── -->
        <div class="mm-section" data-section="audio" style="display:none;flex-direction:column;gap:14px;width:100%;">
          <div class="mm-section-title">♪  AUDIO SETTINGS</div>

          ${this._audioSliderHTML('masterVol', 'MASTER VOLUME',  0.6)}
          ${this._audioSliderHTML('droneVol',  'DRONE HUM',      1.0)}
          ${this._audioSliderHTML('rainVol',   'RAIN / WEATHER', 1.0)}
          ${this._audioSliderHTML('windVol',   'WIND NOISE',     1.0)}

          <button id="btn-toggle-mute" class="cyber-btn cyan-btn mm-item" data-action="toggle-mute">
            🔇  MUTE AUDIO
          </button>
          <button class="cyber-btn ghost-btn" data-action="back-to-main" style="margin-top:4px;">← BACK</button>
        </div>

        <!-- ── SECTION: tactical ─────────────────────────────────── -->
        <div class="mm-section" data-section="tactical" style="display:none;flex-direction:column;gap:14px;width:100%;align-items:center;">
          <div class="mm-section-title">◈  TACTICAL MAP</div>
          <div style="color:#00ffcc99;font-size:11px;letter-spacing:2px;text-align:center;line-height:1.8;">
            TACTICAL MAP IS AVAILABLE DURING ACTIVE MISSIONS.<br>
            ACCESS IN-GAME VIA THE MINIMAP PANEL (BOTTOM-LEFT).<br><br>
            <span style="color:#00ffcc44;">ZOOM: [ + ] / [ − ] BUTTONS ON MAP PANEL</span>
          </div>
          <div class="mm-tactical-preview">
            <canvas id="mm-tac-preview" width="200" height="200"></canvas>
            <div class="mm-tac-overlay">LIVE FEED OFFLINE</div>
          </div>
          <button class="cyber-btn ghost-btn" data-action="back-to-main">← BACK</button>
        </div>

        <!-- ── SECTION: exit confirm ─────────────────────────────── -->
        <div class="mm-section" data-section="exit" style="display:none;flex-direction:column;gap:16px;width:100%;align-items:center;">
          <div class="mm-section-title" style="color:#ff2255;">✕  TERMINATE SESSION?</div>
          <div style="color:#ff225566;font-size:11px;letter-spacing:2px;text-align:center;">
            ALL UNSAVED PROGRESS WILL BE LOST.<br>
            NETRUNNER CORP DISCLAIMS ALL LIABILITY.
          </div>
          <button class="cyber-btn red-btn" data-action="confirm-exit" style="width:220px;">CONFIRM EXIT</button>
          <button class="cyber-btn ghost-btn" data-action="cancel-exit" style="width:220px;">CANCEL</button>
        </div>

      </div><!-- /mm-center -->

      <!-- Right panel — decorative data readouts -->
      <div class="mm-right-panel">
        <div class="mm-data-block">
          <div class="mm-data-label">SYS STATUS</div>
          <div class="mm-data-value" style="color:#00ff88;">NOMINAL</div>
        </div>
        <div class="mm-data-block">
          <div class="mm-data-label">NET LINK</div>
          <div class="mm-data-value" id="mm-net-link">SCANNING…</div>
        </div>
        <div class="mm-data-block">
          <div class="mm-data-label">WEATHER</div>
          <div class="mm-data-value" id="mm-weather-status">CLEAR</div>
        </div>
        <div class="mm-data-block">
          <div class="mm-data-label">BUILD</div>
          <div class="mm-data-value" style="color:#00ffcc44;">v2.0.1-RC</div>
        </div>
        <div class="mm-waveform" id="mm-waveform"></div>
      </div>

    </div><!-- /screen-main-menu -->


    <!-- ════════════════════════════════════ PAUSE SCREEN ══════════════════ -->
    <div id="screen-pause" style="
      position:fixed;inset:0;background:rgba(0,0,16,0.82);
      backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);
      display:none;flex-direction:column;align-items:center;justify-content:center;
      z-index:900;font-family:Orbitron,monospace;">

      <div style="border:1px solid #00ffcc44;box-shadow:0 0 60px #00ffcc22,inset 0 0 60px rgba(0,0,20,0.9);
        padding:60px 80px;text-align:center;min-width:360px;">
        <div style="font-size:11px;letter-spacing:6px;color:#00ffcc66;margin-bottom:8px;">SYSTEM</div>
        <div style="font-size:36px;letter-spacing:8px;color:#00ffcc;
          text-shadow:0 0 30px #00ffcc,0 0 60px #00ffcc44;margin-bottom:48px;">PAUSED</div>
        <div style="height:1px;background:linear-gradient(90deg,transparent,#00ffcc44,transparent);margin-bottom:40px;"></div>
        <div style="display:flex;flex-direction:column;gap:16px;align-items:center;">
          <button id="btn-resume"          class="cyber-btn cyan-btn"  style="width:240px;" data-action="pause-resume">RESUME</button>
          <button id="btn-pause-restart"   class="cyber-btn amber-btn" style="width:240px;" data-action="pause-restart">RESTART MISSION</button>
          <button id="btn-pause-main-menu" class="cyber-btn ghost-btn" style="width:240px;" data-action="pause-main-menu">MAIN MENU</button>
        </div>
        <div style="margin-top:40px;font-size:10px;color:#00ffcc33;letter-spacing:3px;">ESC · P  TO RESUME</div>
      </div>
    </div>


    <!-- ════════════════════════════════════ GAME OVER SCREEN ═════════════ -->
    <div id="screen-dead" style="
      position:fixed;inset:0;background:#000000ee;
      display:none;flex-direction:column;align-items:center;justify-content:center;
      z-index:1000;font-family:Orbitron,monospace;color:#ff2255;">
      <div style="font-size:42px;margin-bottom:20px;text-shadow:0 0 40px #ff2255;">DRONE DESTROYED</div>
      <div style="color:#ffffff88;font-size:13px;margin-bottom:8px;">SCORE: <span id="dead-score" style="color:#fff;">0</span></div>
      <div style="color:#ffffff88;font-size:13px;margin-bottom:8px;">DELIVERIES: <span id="dead-deliveries" style="color:#fff;">0</span></div>
      <div style="color:#ffffff88;font-size:13px;margin-bottom:36px;">BEST: <span id="dead-hi" style="color:#fff;">0</span></div>
      <button id="btn-restart" class="cyber-btn red-btn" style="font-size:14px;padding:15px 48px;">RESTART</button>
    </div>

    `);

    // Animate the right-panel status readouts
    this._startAmbientAnimations();
  }

  _audioSliderHTML(param, label, defaultVal) {
    const pct = Math.round(defaultVal * 100);
    return `
      <div class="mm-setting-row">
        <span class="mm-setting-label">${label}</span>
        <div style="display:flex;align-items:center;gap:10px;">
          <input type="range" min="0" max="1" step="0.01" value="${defaultVal}"
            id="sl-${param}" data-audio-param="${param}" class="cp-slider" style="width:110px;">
          <span id="val-${param}" class="mm-val-badge">${pct}%</span>
        </div>
      </div>`;
  }

  _startAmbientAnimations() {
    // Net link blinking status
    const statuses = ['CONNECTED', 'HANDSHAKE…', '128-BIT ENC', 'SECURE'];
    let si = 0;
    setInterval(() => {
      si = (si + 1) % statuses.length;
      const el = document.getElementById('mm-net-link');
      if (el) el.textContent = statuses[si];
    }, 2200);

    // Weather ticker
    const weathers = ['CLEAR', 'RAIN INCOMING', 'THUNDERSTORM', 'FOG ADVISORY', 'CLEAR'];
    let wi = 0;
    setInterval(() => {
      wi = (wi + 1) % weathers.length;
      const el = document.getElementById('mm-weather-status');
      if (el) el.textContent = weathers[wi];
    }, 4000);

    // Mini waveform bars
    const wf = document.getElementById('mm-waveform');
    if (wf) {
      for (let i = 0; i < 18; i++) {
        const bar = document.createElement('div');
        bar.className = 'wf-bar';
        bar.style.animationDelay = (i * 0.09) + 's';
        wf.appendChild(bar);
      }
    }

    // Tactical map preview — draw static grid
    setTimeout(() => {
      const cv = document.getElementById('mm-tac-preview');
      if (!cv) return;
      const ctx2 = cv.getContext('2d');
      ctx2.fillStyle = '#000a0f';
      ctx2.fillRect(0, 0, 200, 200);
      ctx2.strokeStyle = '#00ffcc18';
      ctx2.lineWidth = 1;
      for (let i = 0; i <= 200; i += 20) {
        ctx2.beginPath(); ctx2.moveTo(i, 0); ctx2.lineTo(i, 200); ctx2.stroke();
        ctx2.beginPath(); ctx2.moveTo(0, i); ctx2.lineTo(200, i); ctx2.stroke();
      }
      // Random "buildings"
      ctx2.fillStyle = '#00ffcc22';
      for (let b = 0; b < 30; b++) {
        const x = Math.random() * 180 + 10;
        const y = Math.random() * 180 + 10;
        const w = Math.random() * 8 + 4;
        const h = Math.random() * 8 + 4;
        ctx2.fillRect(x, y, w, h);
      }
      // Drone marker
      ctx2.fillStyle = '#00ffcc';
      ctx2.beginPath();
      ctx2.arc(100, 100, 4, 0, Math.PI * 2);
      ctx2.fill();
    }, 200);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Styles
  // ══════════════════════════════════════════════════════════════════════════

  _injectStyles() {
    const s = document.createElement('style');
    s.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Share+Tech+Mono&display=swap');

      /* ── Reset / base ── */
      *, *::before, *::after { box-sizing: border-box; }

      /* ── Full-screen overlay ── */
      .cp-overlay {
        position: fixed; inset: 0;
        background: #000509;
        z-index: 1000;
        font-family: Orbitron, monospace;
        color: #00ffcc;
        overflow: hidden;
      }

      /* ── Scanline overlay ── */
      .cp-overlay::before {
        content: '';
        position: absolute; inset: 0;
        background: repeating-linear-gradient(
          0deg,
          transparent,
          transparent 2px,
          rgba(0,255,204,0.018) 2px,
          rgba(0,255,204,0.018) 4px
        );
        pointer-events: none;
        z-index: 1;
      }

      /* ── Left gutter ── */
      .mm-gutter {
        position: relative;
        width: 60px;
        flex-shrink: 0;
        border-right: 1px solid #00ffcc12;
        overflow: hidden;
      }
      .mm-vert-line {
        position: absolute;
        top: 0; bottom: 0; width: 1px;
        background: linear-gradient(180deg, transparent, #00ffcc44, transparent);
        animation: vline-pulse 3s ease-in-out infinite;
      }
      @keyframes vline-pulse {
        0%,100% { opacity: 0.2; } 50% { opacity: 0.8; }
      }
      .mm-scan-bar {
        position: absolute; left: 0; right: 0;
        height: 2px;
        background: linear-gradient(90deg, transparent, #00ffcc88, transparent);
        animation: scandown 4s linear infinite;
        box-shadow: 0 0 8px #00ffcc66;
      }
      @keyframes scandown {
        from { top: 0; } to { top: 100%; }
      }

      /* ── Centre panel ── */
      .mm-center {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        justify-content: center;
        padding: 60px 60px 60px 80px;
        max-width: 520px;
        position: relative;
        z-index: 2;
      }

      /* ── Logo ── */
      .mm-logo-block { margin-bottom: 36px; }
      .mm-eyebrow {
        font-size: 9px; letter-spacing: 4px;
        color: #00ffcc44; margin-bottom: 10px;
      }
      .mm-logo {
        font-size: 62px; font-weight: 900; letter-spacing: 2px;
        color: #00ffcc;
        text-shadow: 0 0 40px #00ffcc, 0 0 80px #00ffcc44;
        line-height: 1;
      }
      .mm-logo-accent { color: #ff2255; text-shadow: 0 0 40px #ff2255; }
      .mm-sub {
        font-size: 10px; letter-spacing: 5px;
        color: #00ffcc66; margin-top: 8px;
      }
      .mm-divider {
        height: 1px; width: 100%;
        background: linear-gradient(90deg, #00ffcc44, transparent);
        margin-top: 24px;
      }

      /* ── Section titles ── */
      .mm-section-title {
        font-size: 12px; letter-spacing: 5px;
        color: #00ffcc88;
        padding-bottom: 12px;
        border-bottom: 1px solid #00ffcc22;
        width: 100%;
      }

      /* ── Settings rows ── */
      .mm-setting-row {
        display: flex; align-items: center;
        justify-content: space-between;
        font-size: 10px; letter-spacing: 2px;
        color: #00ffcc99;
        padding: 6px 0;
        border-bottom: 1px solid #00ffcc0a;
      }
      .mm-setting-label { font-size: 10px; letter-spacing: 2px; }
      .mm-btn-group { display: flex; gap: 6px; }
      .mm-toggle-btn { padding: 6px 16px !important; font-size: 10px !important; }
      .mm-speed-btn  { padding: 6px 12px !important; font-size: 10px !important; }
      .mm-val-badge {
        font-family: 'Share Tech Mono', monospace;
        font-size: 11px; color: #00ffcc; min-width: 38px; text-align: right;
      }

      /* ── Footer stat ── */
      .mm-footer-stat {
        margin-top: 16px;
        font-size: 10px; letter-spacing: 3px; color: #00ffcc44;
      }

      /* ── Right panel ── */
      .mm-right-panel {
        width: 180px;
        flex-shrink: 0;
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        padding: 60px 30px;
        border-left: 1px solid #00ffcc0a;
        gap: 24px;
        position: relative;
        z-index: 2;
      }
      .mm-data-block { width: 100%; }
      .mm-data-label {
        font-size: 8px; letter-spacing: 3px; color: #00ffcc44;
        margin-bottom: 4px;
      }
      .mm-data-value {
        font-family: 'Share Tech Mono', monospace;
        font-size: 11px; color: #00ffcc99;
      }

      /* ── Waveform ── */
      .mm-waveform {
        display: flex; align-items: flex-end;
        gap: 3px; height: 40px; margin-top: auto;
      }
      .wf-bar {
        width: 4px; background: #00ffcc44;
        border-radius: 2px;
        animation: wf-bounce 1.2s ease-in-out infinite alternate;
      }
      @keyframes wf-bounce {
        from { height: 4px; opacity: 0.3; }
        to   { height: 32px; opacity: 0.8; }
      }

      /* ── Tactical preview ── */
      .mm-tactical-preview {
        position: relative; width: 200px; height: 200px;
        border: 1px solid #00ffcc22;
        box-shadow: 0 0 20px #00ffcc11;
      }
      .mm-tac-overlay {
        position: absolute; inset: 0;
        display: flex; align-items: center; justify-content: center;
        font-size: 9px; letter-spacing: 3px; color: #00ffcc33;
        pointer-events: none;
      }

      /* ── Shared cyber buttons ── */
      .cyber-btn {
        background: none;
        border: 1px solid currentColor;
        font-family: Orbitron, monospace;
        font-size: 11px;
        letter-spacing: 4px;
        padding: 13px 24px;
        cursor: pointer;
        text-transform: uppercase;
        transition: box-shadow .2s, background .2s, border-color .2s;
        text-align: left;
        width: 100%;
        display: flex;
        align-items: center;
        gap: 10px;
        position: relative;
        overflow: hidden;
      }
      .cyber-btn::after {
        content: '';
        position: absolute; left: -100%; top: 0;
        width: 60%; height: 100%;
        background: linear-gradient(90deg, transparent, rgba(255,255,255,0.04), transparent);
        transition: left .5s ease;
      }
      .cyber-btn:hover::after { left: 160%; }
      .cyber-btn:hover  { background: rgba(255,255,255,0.04); }
      .cyber-btn:active { background: rgba(255,255,255,0.08); }
      .cyber-btn:disabled { cursor: default; }

      .cyan-btn  { color:#00ffcc; border-color:#00ffcc33; }
      .cyan-btn:hover:not(:disabled)  { box-shadow:0 0 24px #00ffcc33; border-color:#00ffcc; }

      .amber-btn { color:#ffaa00; border-color:#ffaa0033; }
      .amber-btn:hover:not(:disabled) { box-shadow:0 0 24px #ffaa0033; border-color:#ffaa00; }

      .ghost-btn { color:#aaaacc; border-color:#aaaacc22; }
      .ghost-btn:hover:not(:disabled) { box-shadow:0 0 16px #aaaacc22; border-color:#aaaacc66; }

      .red-btn   { color:#ff2255; border-color:#ff225533; }
      .red-btn:hover:not(:disabled)   { box-shadow:0 0 24px #ff225533; border-color:#ff2255; }

      .btn-icon { font-size: 13px; width: 16px; flex-shrink: 0; }

      /* ── Range slider ── */
      .cp-slider {
        -webkit-appearance: none; appearance: none;
        height: 3px; background: #00ffcc22; border-radius: 2px; outline: none;
        cursor: pointer;
      }
      .cp-slider::-webkit-slider-thumb {
        -webkit-appearance: none; appearance: none;
        width: 12px; height: 12px; border-radius: 50%;
        background: #00ffcc; cursor: pointer;
        box-shadow: 0 0 8px #00ffcc88;
      }

      /* ── Score popup ── */
      .score-popup {
        position: absolute; left: 50%; top: 40%;
        transform: translate(-50%,-50%);
        color: #00ffcc; font-size: 32px;
        font-family: Orbitron, monospace;
        text-shadow: 0 0 20px #00ffcc;
        pointer-events: none;
        animation: popFade 1.5s ease-out forwards;
      }
      @keyframes popFade {
        0%   { opacity:1; transform:translate(-50%,-50%); }
        100% { opacity:0; transform:translate(-50%,-130%); }
      }

      /* ── Pickup-specific popup ── */
      .score-popup--pickup {
        display: flex; flex-direction: column; align-items: center;
        gap: 4px; color: #ffff00; font-size: 36px;
        text-shadow: 0 0 24px #ffff00, 0 0 48px #ff8800aa;
        animation: pickupPop 2.0s ease-out forwards;
      }
      .spp-pts  { font-size: 40px; letter-spacing: 2px; }
      .spp-label{ font-size: 13px; letter-spacing: 4px; color: #ff8800;
                  text-shadow: 0 0 12px #ff8800; }
      @keyframes pickupPop {
        0%   { opacity:0; transform:translate(-50%,-30%) scale(0.6); }
        12%  { opacity:1; transform:translate(-50%,-50%) scale(1.15); }
        25%  { transform:translate(-50%,-50%) scale(1.0); }
        75%  { opacity:1; }
        100% { opacity:0; transform:translate(-50%,-160%); }
      }

      /* ── Score flash ── */
      @keyframes scoreBurst {
        0%   { color:#ffffff; text-shadow:0 0 30px #ffffff,0 0 60px #ffff00; transform:scale(1.4); }
        100% { color:#ff00ff; text-shadow:0 0 15px #ff00ff88; transform:scale(1.0); }
      }
      #score-val.score-flash {
        animation: scoreBurst 0.6s ease-out forwards;
      }

      /* ── HUD notification bar ── */
      #hud-notification {
        position: absolute; left: 50%; bottom: 160px;
        transform: translateX(-50%);
        font-family: Orbitron, monospace; font-size: 11px;
        letter-spacing: 3px; pointer-events: none;
        transition: opacity 0.4s, transform 0.4s;
        opacity: 0;
      }
      #hud-notification.hud-notif-show {
        opacity: 1; transform: translateX(-50%) translateY(0px);
        animation: notifSlide 0.35s ease-out forwards;
      }
      #hud-notification.hud-notif-hide { opacity: 0; }
      @keyframes notifSlide {
        from { opacity:0; transform:translateX(-50%) translateY(10px); }
        to   { opacity:1; transform:translateX(-50%) translateY(0); }
      }

      /* ── Glitch hover on logo ── */
      .mm-logo:hover {
        animation: glitch 0.3s ease-in-out;
      }
      @keyframes glitch {
        0%   { text-shadow: 0 0 40px #00ffcc, 0 0 80px #00ffcc44; clip-path: none; }
        20%  { text-shadow: -3px 0 #ff2255, 3px 0 #00ffff; clip-path: inset(10% 0 80% 0); }
        40%  { text-shadow: 3px 0 #ff2255, -3px 0 #00ffff; clip-path: inset(60% 0 20% 0); }
        60%  { text-shadow: -3px 0 #ff2255, 3px 0 #00ffff; clip-path: inset(30% 0 50% 0); }
        100% { text-shadow: 0 0 40px #00ffcc, 0 0 80px #00ffcc44; clip-path: none; }
      }
    `;
    document.head.appendChild(s);
  }
}
