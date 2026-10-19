export class Sound {
  private context: AudioContext | null = null;
  enabled = true;
  volume = .65;
  private ambient: GainNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private stepClock = 0;
  update(dt:number,playing:boolean,speed:number,swimming:boolean,flying:boolean,biome:string,charging:boolean):void {
    if(!this.context)return; // Audio is unlocked by the player's first gesture.
    const ctx=this.context;
    if(!this.ambient){
      const buffer=ctx.createBuffer(1,ctx.sampleRate*2,ctx.sampleRate),data=buffer.getChannelData(0);
      let last=0;for(let i=0;i<data.length;i++){last=(last+Math.random()*.04-.02)/1.02;data[i]=last*5;}
      const source=ctx.createBufferSource();source.buffer=buffer;source.loop=true;
      this.filter=ctx.createBiquadFilter();this.filter.type='lowpass';
      this.ambient=ctx.createGain();this.ambient.gain.value=0;source.connect(this.filter).connect(this.ambient).connect(ctx.destination);source.start();
    }
    const amount=!playing||!this.enabled?0:(swimming?.055:flying?.035:biome==='desert'?.025:.012)*(charging?1.3:1)*this.volume;
    this.ambient.gain.setTargetAtTime(amount,ctx.currentTime,.2);
    this.filter!.frequency.setTargetAtTime(swimming?900:flying?650:300,ctx.currentTime,.3);
    if(playing&&speed>.4&&!flying){this.stepClock+=dt*Math.min(3,speed/2.2);if(this.stepClock>.5){this.stepClock=0;this.play(swimming?'water':biome==='snow'?'snow':biome==='desert'?'sand':biome==='crimson'?'sand':'step');}}
  }

  private get audio(): AudioContext | null {
    if (!this.enabled) return null;
    try {
      this.context ??= new AudioContext();
      if (this.context.state === 'suspended') void this.context.resume();
      return this.context;
    } catch { return null; }
  }

  play(type: 'click' | 'select' | 'jump' | 'charge' | 'beam' | 'impact' | 'deny' | 'step' | 'sand' | 'snow' | 'water' | 'animal' | 'land'): void {
    const ctx = this.audio;
    if (!ctx) return;
    const specs = {
      step: [110,55,.07,.025], sand:[95,45,.10,.018], snow:[180,70,.13,.02], water:[290,90,.17,.025], animal:[130,60,.3,.07], land:[100,38,.2,.06],
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
    amp.gain.exponentialRampToValueAtTime(Math.max(.001,volume*this.volume), ctx.currentTime + 0.024);
    amp.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(amp).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration + 0.03);
  }
}
