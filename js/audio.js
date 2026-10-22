const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export class ArenaAudio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.enabled = true;
    this.musicOn = false;
    this.musicTimer = null;
    this.nextNote = 0;
    this.step = 0;
    this.noise = null;
  }

  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.enabled ? 0.9 : 0;
    this.master.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.0;
    this.musicGain.connect(this.master);
    this.noise = this._noiseBuffer(1.2);
  }

  setEnabled(on) {
    this.enabled = on;
    if (this.master) this.master.gain.setTargetAtTime(on ? 0.9 : 0, this.ctx.currentTime, 0.05);
  }

  _noiseBuffer(seconds) {
    const len = Math.floor(this.ctx.sampleRate * seconds);
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  _noise(dur, gain, filterType = 'bandpass', freq = 900, q = 0.8) {
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = 0.7 + Math.random() * 0.6;
    const f = this.ctx.createBiquadFilter();
    f.type = filterType;
    f.frequency.setValueAtTime(freq, t);
    f.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  _tone(freq, dur, gain, type = 'sine', slideTo = null, delay = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.03);
  }

  punch() {
    if (!this.ctx) return;
    this._noise(0.12, 0.32, 'bandpass', 1500, 1.2);
    this._tone(150, 0.14, 0.3, 'sine', 60);
  }

  kick() {
    if (!this.ctx) return;
    this._noise(0.18, 0.35, 'lowpass', 1100, 0.7);
    this._tone(110, 0.22, 0.34, 'triangle', 42);
  }

  whiff() {
    if (!this.ctx) return;
    this._noise(0.16, 0.09, 'highpass', 1800, 0.6);
  }

  block() {
    if (!this.ctx) return;
    this._noise(0.1, 0.22, 'highpass', 2600, 0.9);
    this._tone(660, 0.09, 0.12, 'square', 420);
  }

  hit(power = 1) {
    if (!this.ctx) return;
    this._noise(0.2, 0.42 * power, 'bandpass', 700, 0.8);
    this._tone(90, 0.28, 0.45 * power, 'sine', 40);
    this._tone(420, 0.08, 0.12, 'square', 180);
  }

  special() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.setValueAtTime(300, t);
    f.frequency.exponentialRampToValueAtTime(4200, t + 0.45);
    f.Q.value = 1.2;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.3, t + 0.08);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    src.connect(f).connect(g).connect(this.master);
    src.start(t);
    src.stop(t + 0.55);
    this._tone(70, 0.7, 0.4, 'sawtooth', 32);
    this._tone(880, 0.4, 0.1, 'sine', 220);
  }

  impact() {
    if (!this.ctx) return;
    this._tone(55, 0.8, 0.5, 'sine', 24);
    this._noise(0.5, 0.4, 'lowpass', 480, 0.5);
  }

  ko() {
    if (!this.ctx) return;
    this.impact();
    this._tone(196, 1.4, 0.18, 'sine', 98, 0.05);
    this._tone(146.8, 1.6, 0.14, 'sine', 73.4, 0.12);
  }

  gong() {
    if (!this.ctx) return;
    [196, 293.7, 392, 587.3].forEach((f, i) => this._tone(f, 1.6 - i * 0.22, 0.1 - i * 0.015, 'sine', f * 0.99, i * 0.01));
    this._noise(0.8, 0.08, 'lowpass', 800, 0.5);
  }

  ui() {
    if (!this.ctx) return;
    this._tone(760, 0.06, 0.1, 'sine', 980);
  }

  win() {
    if (!this.ctx) return;
    [392, 523.25, 659.25, 783.99, 1046.5].forEach((f, i) => this._tone(f, 0.5, 0.12, 'triangle', null, i * 0.11));
  }

  lose() {
    if (!this.ctx) return;
    [392, 349.23, 293.66, 246.94].forEach((f, i) => this._tone(f, 0.7, 0.1, 'sine', null, i * 0.16));
  }

  startMusic() {
    if (!this.ctx || this.musicOn) return;
    this.musicOn = true;
    this.step = 0;
    this.musicGain.gain.setTargetAtTime(0.55, this.ctx.currentTime, 1.2);
    const droneGain = this.ctx.createGain();
    droneGain.gain.value = 0.055;
    droneGain.connect(this.musicGain);
    [55, 82.41, 110].forEach((f, i) => {
      const o = this.ctx.createOscillator();
      o.type = i === 0 ? 'sine' : 'triangle';
      o.frequency.value = f;
      o.detune.value = i * 4 - 4;
      const lfo = this.ctx.createOscillator();
      lfo.frequency.value = 0.07 + i * 0.03;
      const lfoGain = this.ctx.createGain();
      lfoGain.gain.value = 2.6;
      lfo.connect(lfoGain).connect(o.frequency);
      lfo.start();
      o.connect(droneGain);
      o.start();
    });
    this.musicDrone = droneGain;
    const scale = [220, 261.63, 293.66, 349.23, 392, 440, 523.25];
    this.nextNote = this.ctx.currentTime + 0.3;
    this.musicTimer = setInterval(() => {
      if (!this.musicOn) return;
      const now = this.ctx.currentTime;
      while (this.nextNote < now + 0.6) {
        const s = this.step++;
        if (s % 8 === 0 || s % 8 === 5) this._taiko(this.nextNote, s % 16 === 0 ? 1 : 0.65);
        if (s % 4 === 2) this._flute(this.nextNote, scale[(Math.floor(s / 4) * 3) % scale.length]);
        if (s % 16 === 10) this._flute(this.nextNote, scale[2], 0.045);
        this.nextNote += 0.3125;
      }
    }, 120);
  }

  _taiko(when, power = 1) {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(120, when);
    o.frequency.exponentialRampToValueAtTime(46, when + 0.24);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(0.5 * power, when + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.4);
    o.connect(g).connect(this.musicGain);
    o.start(when);
    o.stop(when + 0.45);
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 500;
    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(0.0001, when);
    ng.gain.exponentialRampToValueAtTime(0.14 * power, when + 0.006);
    ng.gain.exponentialRampToValueAtTime(0.0001, when + 0.18);
    src.connect(f).connect(ng).connect(this.musicGain);
    src.start(when);
    src.stop(when + 0.2);
  }

  _flute(when, freq, gain = 0.07) {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(freq, when);
    o.frequency.linearRampToValueAtTime(freq * 1.01, when + 0.5);
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 5.4;
    const lg = this.ctx.createGain();
    lg.gain.value = 3.4;
    lfo.connect(lg).connect(o.frequency);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(gain, when + 0.09);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 1.1);
    o.connect(g).connect(this.musicGain);
    lfo.start(when);
    o.start(when);
    o.stop(when + 1.2);
    lfo.stop(when + 1.2);
  }

  stopMusic() {
    if (!this.musicOn) return;
    this.musicOn = false;
    clearInterval(this.musicTimer);
    this.musicTimer = null;
    if (this.musicGain) this.musicGain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.4);
    const drone = this.musicDrone;
    if (drone) setTimeout(() => { try { drone.disconnect(); } catch {} }, 1500);
    this.musicDrone = null;
  }
}
