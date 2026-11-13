// Interface sounds synthesized in the browser, the same set as the reels (hud.py ui_sounds): a thump for a new mission,
// a tick for the key prompt and the subtitle, a two-note chime when a mission is ticked, a D major chord at the end.
// Wildlife/shore recordings share this graph, but are optional and managed separately.

export class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private muted = false;
  private paused = false;
  private resumeError: string | null = null;

  get available() {
    return typeof window !== 'undefined' && typeof (window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext) === 'function';
  }

  start() {
    // Called only by beginPlay's click. A failed optional audio device cannot block the game.
    if (!this.ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      try {
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.muted || this.paused ? 0 : 0.7;
        this.master.connect(this.ctx.destination);
      } catch (error) { this.resumeError = String(error); return null; }
    }
    this.resumeFromGesture();
    return this.master ? { context: this.ctx, output: this.master } : null;
  }

  /** Reuse the unlocked context after iOS interrupts it; never create another on ordinary input. */
  resumeFromGesture() {
    const ctx = this.ctx;
    if (!ctx || ctx.state === 'closed' || ctx.state === 'running') return;
    try { void ctx.resume().then(() => { this.resumeError = null; }, error => { this.resumeError = String(error); }); }
    catch (error) { this.resumeError = String(error); }
  }

  setMuted(muted: boolean) { if(this.muted===muted)return;this.muted = muted; this.applyGain(); }
  setPaused(paused: boolean) { if(this.paused===paused)return;this.paused = paused; this.applyGain(); }
  get stats() { return { available: this.available, contextState: this.ctx?.state ?? 'not-created', muted: this.muted, paused: this.paused, resumeError: this.resumeError, syntheticWaves: false }; }
  private applyGain() {
    if (!this.ctx || !this.master) return;
    const gain=this.master.gain,time=this.ctx.currentTime;
    gain.cancelScheduledValues(time);gain.setTargetAtTime(this.muted || this.paused ? 0 : .7,time,.025);
  }

  private tone(f: number, dur: number, amp: number, decay: number, at = 0, attack = 0.004) {
    const ctx = this.ctx; if (!ctx || !this.master || this.muted || this.paused) return;
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
    const ctx = this.ctx; if (!ctx || !this.master || this.muted || this.paused) return;
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
