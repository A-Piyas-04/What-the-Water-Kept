import type { AmbienceDef } from '@/world/types';
import { AudioEngine, DEFAULT_LEVELS, type MixerLevels } from './engine';
import { Synth } from './synth';
import { Ambience } from './ambience';

/**
 * The single audio facade the rest of the game talks to.
 *
 * Everything degrades to silence rather than throwing: if the AudioContext
 * cannot start (an old WebView, audio focus denied, a headless test run) the
 * game remains completely playable.
 */
export class GameAudio {
  readonly engine = new AudioEngine();
  readonly synth: Synth;
  readonly ambience: Ambience;

  private heart: ReturnType<Synth['heartbeat']> | null = null;
  private choirStop: (() => void) | null = null;
  private floodHandle: ReturnType<Synth['flood']> | null = null;

  constructor() {
    this.synth = new Synth(this.engine);
    this.ambience = new Ambience(this.engine);
  }

  get ready(): boolean {
    return this.engine.ready;
  }

  async unlock(): Promise<boolean> {
    const ok = await this.engine.unlock();
    if (ok && !this.heart) this.heart = this.synth.heartbeat();
    return ok;
  }

  setLevels(levels: Partial<MixerLevels>): void {
    this.engine.setLevels(levels);
  }

  getLevels(): MixerLevels {
    return this.engine.ready ? this.engine.getLevels() : { ...DEFAULT_LEVELS };
  }

  playAmbience(def: AmbienceDef): void {
    if (!this.engine.ready) return;
    this.ambience.play(def);
  }

  stopAmbience(fade = 1.2): void {
    this.ambience.stop(fade);
  }

  /** Dread drives the heartbeat, which is the only music cue in most scenes. */
  setDread(value: number): void {
    if (!this.heart) return;
    this.heart.setLevel(Math.max(0, (value - 0.18) / 0.82));
    this.heart.setRate(60 + value * 62);
  }

  startChoir(voices = 9, baseHz = 98): void {
    if (!this.engine.ready || this.choirStop) return;
    this.choirStop = this.synth.choir(voices, baseHz);
  }

  stopChoir(): void {
    this.choirStop?.();
    this.choirStop = null;
  }

  get choirPlaying(): boolean {
    return this.choirStop !== null;
  }

  startFlood(): void {
    if (!this.engine.ready || this.floodHandle) return;
    this.floodHandle = this.synth.flood();
  }

  setFlood(intensity: number): void {
    this.floodHandle?.setIntensity(intensity);
  }

  stopFlood(): void {
    this.floodHandle?.stop();
    this.floodHandle = null;
  }

  async suspend(): Promise<void> {
    await this.engine.suspend();
  }

  async resume(): Promise<void> {
    await this.engine.resume();
  }

  /** Full teardown, used when returning to the title screen. */
  silence(): void {
    this.stopChoir();
    this.stopFlood();
    this.stopAmbience(0.6);
    this.heart?.setLevel(0);
  }

  destroy(): void {
    this.silence();
    this.heart?.stop();
    this.heart = null;
    this.engine.destroy();
  }
}

export { type MixerLevels, DEFAULT_LEVELS } from './engine';
