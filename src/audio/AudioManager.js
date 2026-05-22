// src/audio/AudioManager.js

export class AudioManager {
  constructor() {
    this._ctx         = null;
    this._droneGain   = null;
    this._rainGain    = null;
    this._windGain    = null;
    this._masterGain  = null;
    this._ready       = false;
  }

  // Must be called from a user gesture (click / keydown)
  async init() {
    if (this._ready) return;
    this._ctx = new (window.AudioContext || window.webkitAudioContext)();
    this._masterGain = this._ctx.createGain();
    this._masterGain.gain.value = 0.6;
    this._masterGain.connect(this._ctx.destination);

    this._buildDroneHum();
    this._buildRainNoise();
    this._buildWindNoise();
    this._ready = true;
  }

  // ── Drone hum ─────────────────────────────────────────────────────
  _buildDroneHum() {
    const ctx = this._ctx;
    this._droneGain = ctx.createGain();
    this._droneGain.gain.value = 0;
    this._droneGain.connect(this._masterGain);

    this._droneOscs = [0, 3, -3, 6].map(detune => {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = 90 + detune;
      const lpf = ctx.createBiquadFilter();
      lpf.type = 'lowpass';
      lpf.frequency.value = 400;
      lpf.Q.value = 1;
      osc.connect(lpf);
      lpf.connect(this._droneGain);
      osc.start();
      return osc;
    });
  }

  // ── Rain ──────────────────────────────────────────────────────────
  _buildRainNoise() {
    const ctx = this._ctx;
    const bufLen = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const hpf = ctx.createBiquadFilter();
    hpf.type = 'highpass';
    hpf.frequency.value = 3000;
    this._rainGain = ctx.createGain();
    this._rainGain.gain.value = 0;
    source.connect(hpf);
    hpf.connect(this._rainGain);
    this._rainGain.connect(this._masterGain);
    source.start();
  }

  // ── Wind ──────────────────────────────────────────────────────────
  _buildWindNoise() {
    const ctx = this._ctx;
    const bufLen = ctx.sampleRate * 3;
    const buffer = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const bpf = ctx.createBiquadFilter();
    bpf.type = 'bandpass';
    bpf.frequency.value = 200;
    bpf.Q.value = 0.5;
    const lfo = ctx.createOscillator();
    const lfog = ctx.createGain();
    lfo.frequency.value = 0.3;
    lfog.gain.value = 80;
    lfo.connect(lfog);
    lfog.connect(bpf.frequency);
    lfo.start();
    this._windGain = ctx.createGain();
    this._windGain.gain.value = 0;
    source.connect(bpf);
    bpf.connect(this._windGain);
    this._windGain.connect(this._masterGain);
    source.start();
  }

  // ── Per-frame mix ─────────────────────────────────────────────────
  update(droneSpeed, windStrength, rainAmount) {
    if (!this._ready) return;
    const t = this._ctx.currentTime + 0.05;
    const droneVol = 0.15 + Math.min(droneSpeed / 20, 1) * 0.2;
    this._droneGain.gain.setTargetAtTime(droneVol, t, 0.1);
    this._droneOscs.forEach((osc, i) => {
      const detunes = [0, 3, -3, 6];
      osc.frequency.setTargetAtTime(90 + detunes[i] + droneSpeed * 0.8, t, 0.2);
    });
    const rainVol = Math.min(rainAmount / 4000, 1) * 0.25;
    this._rainGain.gain.setTargetAtTime(rainVol, t, 0.3);
    const windVol = Math.min(windStrength / 10, 1) * 0.2;
    this._windGain.gain.setTargetAtTime(windVol, t, 0.4);
  }

  // ── FIX: single definition of each sting (duplicates removed) ─────
  playPickup() {
    if (!this._ready) return;
    this._sting([440, 550, 660], 0.08, 'sine');
  }

  playDelivery() {
    if (!this._ready) return;
    this._sting([523, 659, 784, 1047], 0.12, 'sine');
  }

  playHit() {
    if (!this._ready) return;
    this._sting([120, 80, 60], 0.15, 'sawtooth', true);
  }

  playExplosion() {
    if (!this._ready) return;
    const ctx = this._ctx;
    const bufLen = ctx.sampleRate * 1.5;
    const buffer = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufLen; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.3));
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const g = ctx.createGain();
    g.gain.value = 0.6;
    const lpf = ctx.createBiquadFilter();
    lpf.type = 'lowpass';
    lpf.frequency.value = 600;
    src.connect(lpf);
    lpf.connect(g);
    g.connect(this._masterGain);
    src.start();
  }

  _sting(freqs, vol, type, descend = false) {
    const ctx = this._ctx;
    freqs.forEach((freq, i) => {
      const delay = descend ? i * 0.06 : i * 0.08;
      const osc = ctx.createOscillator();
      const g   = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      g.gain.setValueAtTime(0, ctx.currentTime + delay);
      g.gain.linearRampToValueAtTime(vol, ctx.currentTime + delay + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.3);
      osc.connect(g);
      g.connect(this._masterGain);
      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime + delay + 0.35);
    });
  }

  mute()   { this._masterGain && (this._masterGain.gain.value = 0); }
  unmute() { this._masterGain && (this._masterGain.gain.value = 0.6); }
}
