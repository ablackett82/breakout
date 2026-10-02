// Sound. The cabinet's sounds are short square-wave tones taken from its video
// counters, gated by the ball hitting something; these are stand-ins: a high
// blip for a brick, a middle one for the paddle, a low one for a wall, and a
// falling buzz for a lost ball.

const TONES = { brick: [980, 0.05], paddle: [490, 0.06], wall: [245, 0.05] };

export class Sound {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }

  /** Must be called from a user gesture on iOS. */
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.out = this.ctx.createGain();
      this.out.gain.value = this.muted ? 0 : 0.25;
      this.out.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended' || this.ctx.state === 'interrupted') this.ctx.resume().catch(() => {});
  }

  setMuted(on) {
    this.muted = on;
    if (this.out) this.out.gain.value = on ? 0 : 0.25;
  }

  /** The game's events from the frames just run. */
  play(events) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    for (const e of new Set(events)) {
      if (e === 'lost') this.lost();
      else if (TONES[e]) this.blip(...TONES[e]);
    }
  }

  blip(hz, dur) {
    const c = this.ctx, t = c.currentTime;
    const o = c.createOscillator(), gn = c.createGain();
    o.type = 'square';
    o.frequency.value = hz;
    gn.gain.setValueAtTime(0.6, t);
    gn.gain.setValueAtTime(0.6, t + dur);
    gn.gain.linearRampToValueAtTime(0, t + dur + 0.01);
    o.connect(gn).connect(this.out);
    o.start(t); o.stop(t + dur + 0.02);
  }

  lost() {
    const c = this.ctx, t = c.currentTime;
    const o = c.createOscillator(), gn = c.createGain();
    o.type = 'square';
    o.frequency.setValueAtTime(220, t);
    o.frequency.exponentialRampToValueAtTime(55, t + 0.6);
    gn.gain.setValueAtTime(0.5, t);
    gn.gain.linearRampToValueAtTime(0, t + 0.65);
    o.connect(gn).connect(this.out);
    o.start(t); o.stop(t + 0.7);
  }
}
