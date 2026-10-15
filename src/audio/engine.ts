import { clamp01 } from '@/core/math';

export interface MixerLevels {
  master: number;
  music: number;
  sfx: number;
}

export const DEFAULT_LEVELS: MixerLevels = { master: 0.85, music: 0.7, sfx: 0.9 };

/**
 * Audio bus and room simulation.
 *
 * Every sound in the game is synthesised at runtime - there are no audio files
 * in the bundle at all. That is the same decision as the textures: nothing to
 * download, nothing to fail to load, and the whole soundtrack is offline by
 * construction.
 *
 * Mobile browsers will not start an AudioContext without a user gesture, so
 * `unlock` is called from the first tap on the title screen.
 */
export class AudioEngine {
  private ctx: AudioContext | null = null;

  /** Dry master -> destination. */
  private master!: GainNode;
  private musicBus!: GainNode;
  private sfxBus!: GainNode;
  /** Shared send reverb; scenes set how wet they are. */
  private reverb!: ConvolverNode;
  private reverbSend!: GainNode;
  private reverbReturn!: GainNode;
  /** Gentle limiter so nothing can ever be painfully loud on headphones. */
  private limiter!: DynamicsCompressorNode;

  private levels: MixerLevels = { ...DEFAULT_LEVELS };
  private unlocked = false;
  private suspended = false;

  get context(): AudioContext | null {
    return this.ctx;
  }

  get ready(): boolean {
    return this.unlocked && this.ctx !== null && this.ctx.state === 'running';
  }

  get now(): number {
    return this.ctx?.currentTime ?? 0;
  }

  /** Must be called from a user gesture. Safe to call repeatedly. */
  async unlock(): Promise<boolean> {
    if (this.unlocked && this.ctx) {
      if (this.ctx.state === 'suspended') await this.ctx.resume().catch(() => undefined);
      return this.ctx.state === 'running';
    }
    try {
      const Ctor: typeof AudioContext =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return false;
      this.ctx = new Ctor({ latencyHint: 'interactive' });
      this.build();
      await this.ctx.resume().catch(() => undefined);
      this.unlocked = true;
      return this.ctx.state === 'running';
    } catch {
      this.ctx = null;
      return false;
    }
  }

  private build(): void {
    const ctx = this.ctx!;

    this.limiter = ctx.createDynamicsCompressor();
    this.limiter.threshold.value = -8;
    this.limiter.knee.value = 8;
    this.limiter.ratio.value = 7;
    this.limiter.attack.value = 0.004;
    this.limiter.release.value = 0.22;
    this.limiter.connect(ctx.destination);

    this.master = ctx.createGain();
    this.master.gain.value = this.levels.master;
    this.master.connect(this.limiter);

    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = this.levels.music;
    this.musicBus.connect(this.master);

    this.sfxBus = ctx.createGain();
    this.sfxBus.gain.value = this.levels.sfx;
    this.sfxBus.connect(this.master);

    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this.makeImpulse(2.6, 2.4);
    this.reverbSend = ctx.createGain();
    this.reverbSend.gain.value = 0.3;
    this.reverbReturn = ctx.createGain();
    this.reverbReturn.gain.value = 0.9;
    this.reverbSend.connect(this.reverb);
    this.reverb.connect(this.reverbReturn);
    this.reverbReturn.connect(this.master);
  }

  /**
   * Generated impulse response: decaying noise, darkened over time.
   *
   * A flooded stone valley is a very reverberant place, and a convolver with a
   * synthetic IR gets far closer to that than a delay network - for the cost
   * of one buffer built once at startup.
   */
  private makeImpulse(seconds: number, decay: number): AudioBuffer {
    const ctx = this.ctx!;
    const rate = ctx.sampleRate;
    const length = Math.max(1, Math.floor(rate * seconds));
    const buffer = ctx.createBuffer(2, length, rate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch);
      let lp = 0;
      for (let i = 0; i < length; i++) {
        const t = i / length;
        const envelope = Math.pow(1 - t, decay);
        const noise = Math.random() * 2 - 1;
        // One-pole lowpass whose cutoff falls with time: the tail goes dark,
        // which is what makes it read as stone and water rather than metal.
        const coeff = 0.22 + 0.5 * (1 - t);
        lp += coeff * (noise - lp);
        // A couple of early reflections to give the space a size.
        const early = i === Math.floor(rate * 0.017) || i === Math.floor(rate * 0.031) ? 0.5 : 0;
        data[i] = (lp * envelope + early) * (ch === 0 ? 1 : 0.92);
      }
    }
    return buffer;
  }

  /** Scene reverb amount, 0..1. */
  setSpace(amount: number): void {
    if (!this.ctx) return;
    this.reverbSend.gain.setTargetAtTime(clamp01(amount) * 0.62, this.now, 0.6);
  }

  setLevels(levels: Partial<MixerLevels>): void {
    this.levels = { ...this.levels, ...levels };
    if (!this.ctx) return;
    this.master.gain.setTargetAtTime(clamp01(this.levels.master), this.now, 0.05);
    this.musicBus.gain.setTargetAtTime(clamp01(this.levels.music), this.now, 0.05);
    this.sfxBus.gain.setTargetAtTime(clamp01(this.levels.sfx), this.now, 0.05);
  }

  getLevels(): MixerLevels {
    return { ...this.levels };
  }

  get music(): GainNode {
    return this.musicBus;
  }

  get sfx(): GainNode {
    return this.sfxBus;
  }

  get send(): GainNode {
    return this.reverbSend;
  }

  /** Suspends on backgrounding so Android does not keep the radio awake. */
  async suspend(): Promise<void> {
    if (!this.ctx || this.suspended) return;
    this.suspended = true;
    this.master.gain.setTargetAtTime(0, this.now, 0.08);
    await new Promise((r) => setTimeout(r, 140));
    await this.ctx.suspend().catch(() => undefined);
  }

  async resume(): Promise<void> {
    if (!this.ctx) return;
    this.suspended = false;
    await this.ctx.resume().catch(() => undefined);
    this.master.gain.setTargetAtTime(clamp01(this.levels.master), this.now, 0.25);
  }

  /** Shared noise buffer, so grain-based sounds do not rebuild it each time. */
  private noiseBuffer: AudioBuffer | null = null;

  noise(): AudioBuffer {
    if (this.noiseBuffer) return this.noiseBuffer;
    const ctx = this.ctx!;
    const length = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    this.noiseBuffer = buffer;
    return buffer;
  }

  destroy(): void {
    this.ctx?.close().catch(() => undefined);
    this.ctx = null;
    this.unlocked = false;
  }
}
