/**
 * Synthesised sound effects using Web Audio API.
 * AudioContext is created lazily on first use (requires prior user interaction).
 */
export class GameAudio {
  private ctx: AudioContext | null = null;

  private getCtx(): AudioContext {
    if (!this.ctx) this.ctx = new AudioContext();
    // Resume if suspended (browser autoplay policy)
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  /** Metallic clack — coin hitting coin */
  coinClack(volume = 1) {
    const ctx = this.getCtx();
    const t = ctx.currentTime;

    // Noise burst
    const len = Math.floor(ctx.sampleRate * 0.12);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.5);
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const ng = ctx.createGain();
    ng.gain.value = 0.45 * volume;
    src.connect(ng); ng.connect(ctx.destination);
    src.start(t);

    // Metallic ring — two harmonics
    for (const [freq, amp] of [[700 + Math.random() * 200, 0.18], [1800 + Math.random() * 300, 0.1]] as [number, number][]) {
      const osc = ctx.createOscillator();
      const og = ctx.createGain();
      osc.frequency.value = freq;
      og.gain.setValueAtTime(amp * volume, t);
      og.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
      osc.connect(og); og.connect(ctx.destination);
      osc.start(t); osc.stop(t + 0.1);
    }
  }

  /** Soft click — coin hitting boundary wall */
  wallClick(volume = 0.5) {
    const ctx = this.getCtx();
    const t = ctx.currentTime;

    const len = Math.floor(ctx.sampleRate * 0.07);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 5);
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 600;

    const g = ctx.createGain();
    g.gain.value = 0.28 * volume;

    src.connect(filter); filter.connect(g); g.connect(ctx.destination);
    src.start(t);
  }
}
