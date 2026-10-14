export class Sound {
  private context: AudioContext | null = null;
  enabled = true;

  private get audio(): AudioContext | null {
    if (!this.enabled) return null;
    try {
      this.context ??= new AudioContext();
      if (this.context.state === 'suspended') void this.context.resume();
      return this.context;
    } catch { return null; }
  }

  play(type: 'click' | 'select' | 'jump' | 'charge' | 'beam' | 'impact' | 'deny'): void {
    const ctx = this.audio;
    if (!ctx) return;
    const specs = {
      click: [520, 770, 0.075, 0.08],
      select: [360, 880, 0.22, 0.10],
      jump: [250, 420, 0.13, 0.045],
      charge: [140, 680, 0.30, 0.13],
      beam: [820, 210, 0.47, 0.11],
      impact: [180, 70, 0.35, 0.15],
      deny: [200, 140, 0.15, 0.08]
    } as const;
    const [initial, last, duration, volume] = specs[type];
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = type === 'beam' || type === 'impact' ? 'sawtooth' : 'sine';
    osc.frequency.setValueAtTime(initial, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, last), ctx.currentTime + duration);
    amp.gain.setValueAtTime(0.001, ctx.currentTime);
    amp.gain.exponentialRampToValueAtTime(volume, ctx.currentTime + 0.024);
    amp.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(amp).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration + 0.03);
  }
}
