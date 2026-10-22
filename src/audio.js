export class Sound {
  constructor() {
    this.context = null
    this.master = null
    this.muted = false
    this.stepTimer = 0
  }

  init() {
    if (this.context) {
      if (this.context.state === 'suspended') this.context.resume()
      return
    }
    const AudioContext = window.AudioContext || window.webkitAudioContext
    if (!AudioContext) return
    this.context = new AudioContext()
    this.master = this.context.createGain()
    this.master.gain.value = 0.55
    this.master.connect(this.context.destination)
  }

  setMuted(value) {
    this.muted = value
    if (this.master) this.master.gain.value = value ? 0 : 0.55
  }

  noise(duration, frequency, gainValue, type = 'lowpass') {
    if (!this.context || this.muted) return
    const ctx = this.context
    const length = Math.max(1, Math.floor(ctx.sampleRate * duration))
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
    const channel = buffer.getChannelData(0)
    for (let i = 0; i < length; i += 1) {
      channel[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 2
    }
    const source = ctx.createBufferSource()
    source.buffer = buffer
    const filter = ctx.createBiquadFilter()
    filter.type = type
    filter.frequency.value = frequency
    const gain = ctx.createGain()
    gain.gain.value = gainValue
    source.connect(filter)
    filter.connect(gain)
    gain.connect(this.master)
    source.start()
    source.stop(ctx.currentTime + duration)
  }

  tone(from, to, duration, type, gainValue) {
    if (!this.context || this.muted) return
    const ctx = this.context
    const now = ctx.currentTime
    const oscillator = ctx.createOscillator()
    oscillator.type = type
    oscillator.frequency.setValueAtTime(from, now)
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(30, to), now + duration)
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(gainValue, now)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration)
    oscillator.connect(gain)
    gain.connect(this.master)
    oscillator.start(now)
    oscillator.stop(now + duration + 0.02)
  }

  breakBlock() {
    this.noise(0.16, 900, 0.32)
    this.tone(170, 80, 0.1, 'triangle', 0.08)
  }

  placeBlock() {
    this.tone(320, 190, 0.07, 'square', 0.07)
    this.noise(0.05, 1600, 0.12, 'bandpass')
  }

  jump() {
    this.tone(230, 330, 0.09, 'sine', 0.05)
  }

  land() {
    this.noise(0.08, 420, 0.12)
  }

  step(dt, speed) {
    if (!this.context || this.muted || speed < 1.2) return
    this.stepTimer -= dt * speed
    if (this.stepTimer > 0) return
    this.stepTimer = 1.7
    this.noise(0.07, 520 + Math.random() * 180, 0.055)
  }

  select() {
    this.tone(720, 660, 0.04, 'sine', 0.035)
  }
}
