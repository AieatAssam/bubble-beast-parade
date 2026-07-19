/**
 * WebAudio sound engine. Loads CC0 sample assets when present; otherwise
 * every cue has a synthesised fallback so the game is never silent (SPEC §4).
 *
 * Layered pop: bright sparkle + low thunk, per-pop pitch variation, and a
 * semitone chain ladder so long chains play an ascending musical run.
 */
export class SoundEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private samples = new Map<string, AudioBuffer>();
  private musicNodes: OscillatorNode[] = [];
  private musicTimer: number | null = null;
  private musicIntensity = 0;
  volume = 0.8;
  muted = false;

  /** Lazy init on first user gesture (autoplay policy). */
  ensure(): AudioContext | null {
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.volume;
        this.master.connect(this.ctx.destination);
        this.musicGain = this.ctx.createGain();
        this.musicGain.gain.value = 0.16;
        this.musicGain.connect(this.master);
        void this.loadSamples();
      } catch {
        return null;
      }
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }

  private async loadSamples(): Promise<void> {
    if (!this.ctx) return;
    const manifest: [string, string][] = [
      ["pop", "assets/sfx/pop.ogg"],
      ["thunk", "assets/sfx/thunk.ogg"],
    ];
    for (const [name, url] of manifest) {
      try {
        const res = await fetch(url);
        if (!res.ok) continue;
        const buf = await this.ctx.decodeAudioData(await res.arrayBuffer());
        this.samples.set(name, buf);
      } catch {
        // Synth fallback covers it.
      }
    }
  }

  setVolume(v: number): void {
    this.volume = v;
    if (this.master) this.master.gain.value = this.muted ? 0 : v;
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : this.volume;
  }

  /** pan ∈ [-1, 1] from screen x. chainStep counts same-colour chain pops. */
  pop(pan: number, chainStep: number, big = false): void {
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const t = ctx.currentTime;
    const panner = ctx.createStereoPanner();
    panner.pan.value = Math.max(-1, Math.min(1, pan));
    panner.connect(this.master);

    // Semitone ladder + small random detune so pops never sound mechanical
    const semis = Math.min(chainStep, 24);
    const ladder = Math.pow(2, semis / 12);
    const jitter = 1 + (Math.random() - 0.5) * 0.04;

    const sample = this.samples.get("pop");
    if (sample) {
      const src = ctx.createBufferSource();
      src.buffer = sample;
      src.playbackRate.value = ladder * jitter;
      const g = ctx.createGain();
      g.gain.value = big ? 1 : 0.7;
      src.connect(g).connect(panner);
      src.start(t);
    } else {
      // Bright top sparkle: fast sine chirp down
      const osc = ctx.createOscillator();
      osc.type = "sine";
      const f0 = 880 * ladder * jitter;
      osc.frequency.setValueAtTime(f0 * 1.6, t);
      osc.frequency.exponentialRampToValueAtTime(f0, t + 0.07);
      const g = ctx.createGain();
      g.gain.setValueAtTime(big ? 0.5 : 0.32, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
      osc.connect(g).connect(panner);
      osc.start(t);
      osc.stop(t + 0.2);
      // Sparkle noise tick
      const noise = this.noiseBurst(ctx, 0.05);
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(0.18, t);
      ng.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
      noise.connect(ng).connect(panner);
      noise.start(t);
    }

    // Low-end thunk for body and weight — always synthesised underneath
    const thunk = ctx.createOscillator();
    thunk.type = "sine";
    thunk.frequency.setValueAtTime(150 * jitter, t);
    thunk.frequency.exponentialRampToValueAtTime(55, t + 0.12);
    const tg = ctx.createGain();
    tg.gain.setValueAtTime(big ? 0.55 : 0.35, t);
    tg.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    thunk.connect(tg).connect(panner);
    thunk.start(t);
    thunk.stop(t + 0.2);
  }

  private noiseBurst(ctx: AudioContext, dur: number): AudioBufferSourceNode {
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    return src;
  }

  /** Bright crystal ping for charge refunds. */
  ping(): void {
    this.tone(1318.5, 0.4, "sine", 0.25, 2637);
  }

  /** UI click / hover cue. */
  ui(freq = 660, gain = 0.12): void {
    this.tone(freq, 0.08, "triangle", gain);
  }

  hover(): void {
    this.tone(520, 0.05, "sine", 0.06);
  }

  /** Prism reveal chime — small ascending arpeggio. */
  prismReveal(): void {
    const ctx = this.ensure();
    if (!ctx) return;
    [0, 4, 7, 12].forEach((s, i) => {
      setTimeout(() => this.tone(523.25 * Math.pow(2, s / 12), 0.3, "sine", 0.2), i * 90);
    });
  }

  /** Grand entrance fanfare. */
  grandEntrance(): void {
    const ctx = this.ensure();
    if (!ctx) return;
    [0, 7, 12, 16, 19].forEach((s, i) => {
      setTimeout(() => this.tone(261.63 * Math.pow(2, s / 12), 0.5, "sawtooth", 0.12), i * 130);
    });
  }

  /** Results screen score tick. */
  tick(step: number): void {
    this.tone(700 + step * 12, 0.04, "square", 0.05);
  }

  fanfare(): void {
    [0, 4, 7, 12, 7, 12, 16].forEach((s, i) => {
      setTimeout(() => this.tone(392 * Math.pow(2, s / 12), 0.35, "triangle", 0.18), i * 110);
    });
  }

  private tone(
    freq: number,
    dur: number,
    type: OscillatorType,
    gain: number,
    sweepTo?: number,
  ): void {
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (sweepTo) osc.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  /**
   * Ambient music: gentle synth pad arpeggio whose density follows round
   * intensity (0 calm → 1 finale).
   */
  startMusic(): void {
    const ctx = this.ensure();
    if (!ctx || !this.musicGain || this.musicTimer !== null) return;
    const scale = [0, 3, 5, 7, 10, 12, 15]; // C minor pentatonic-ish, dreamy
    const base = 261.63 / 2;
    let step = 0;
    const playNote = () => {
      if (!ctx || !this.musicGain) return;
      const density = 1 + Math.round(this.musicIntensity * 2);
      for (let v = 0; v < density; v++) {
        const s = scale[Math.floor(Math.random() * scale.length)]!;
        const oct = Math.random() > 0.6 ? 2 : 1;
        const osc = ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.value = base * oct * Math.pow(2, s / 12);
        const g = ctx.createGain();
        const t = ctx.currentTime + v * 0.07;
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.5, t + 0.1);
        g.gain.exponentialRampToValueAtTime(0.001, t + 1.6);
        osc.connect(g).connect(this.musicGain);
        osc.start(t);
        osc.stop(t + 1.8);
      }
      step++;
      const interval = 700 - this.musicIntensity * 330;
      this.musicTimer = window.setTimeout(playNote, interval + Math.random() * 150);
    };
    void step;
    playNote();
  }

  setMusicIntensity(v: number): void {
    this.musicIntensity = Math.max(0, Math.min(1, v));
  }

  stopMusic(): void {
    if (this.musicTimer !== null) {
      clearTimeout(this.musicTimer);
      this.musicTimer = null;
    }
    for (const n of this.musicNodes) n.stop();
    this.musicNodes = [];
  }
}

export const sound = new SoundEngine();
