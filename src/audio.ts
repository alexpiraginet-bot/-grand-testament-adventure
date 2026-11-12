// Interface sounds synthesized in the browser, the same set as the reels (hud.py ui_sounds): a thump for a new mission,
// a tick for the key prompt and the subtitle, a two-note chime when a mission is ticked, a D major chord at the end.
// Plus the lake: filtered noise rising and falling like small waves. No audio files.

export class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;

  start() {
    if (this.ctx) return;
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    this.master = ctx.createGain(); this.master.gain.value = 0.7; this.master.connect(ctx.destination);
    // waves
    const len = ctx.sampleRate * 4, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 520;
    const g = ctx.createGain(); g.gain.value = 0.05;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.13;
    const lg = ctx.createGain(); lg.gain.value = 0.035;
    lfo.connect(lg); lg.connect(g.gain);
    src.connect(lp); lp.connect(g); g.connect(this.master);
    src.start(); lfo.start();
  }

  private tone(f: number, dur: number, amp: number, decay: number, at = 0, attack = 0.004) {
    const ctx = this.ctx; if (!ctx || !this.master) return;
    const t0 = ctx.currentTime + at;
    for (const [mul, a] of [[1, 1], [2, 0.25]] as const) {
      const o = ctx.createOscillator(); o.frequency.value = f * mul;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(amp * a, t0 + attack);
      g.gain.setTargetAtTime(0, t0 + attack, decay);
      o.connect(g); g.connect(this.master); o.start(t0); o.stop(t0 + dur + decay * 4);
    }
  }

  thump(amp = 0.5) {
    const ctx = this.ctx; if (!ctx || !this.master) return;
    const t0 = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(90, t0); o.frequency.exponentialRampToValueAtTime(46, t0 + 0.2);
    g.gain.setValueAtTime(amp, t0); g.gain.setTargetAtTime(0, t0, 0.16);
    o.connect(g); g.connect(this.master); o.start(t0); o.stop(t0 + 0.8);
  }

  tick() { this.tone(1480, 0.07, 0.10, 0.02); }
  line() { this.tone(660, 0.09, 0.06, 0.03); }
  done() { this.tone(880, 0.5, 0.17, 0.16); this.tone(1318.5, 0.7, 0.17, 0.22, 0.1); }
  finale() {
    this.thump(0.5);
    [293.66, 440.0, 587.33, 739.99].forEach((f, i) => this.tone(f, 2.6, 0.12, 0.9, 0.05 * i, 0.05));
  }
}
