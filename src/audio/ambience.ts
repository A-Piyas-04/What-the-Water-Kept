import { clamp01 } from '@/core/math';
import type { AmbienceDef } from '@/world/types';
import type { AudioEngine } from './engine';

interface Layer {
  nodes: AudioNode[];
  gain: GainNode;
  sources: Array<OscillatorNode | AudioBufferSourceNode>;
}

/**
 * Continuous scene ambience: drone, wind, water and structural creaks.
 *
 * Each scene supplies five numbers and gets a bed built from them. The point
 * is contrast - the beds are quiet and mostly static so that a single creak,
 * or the sudden absence of wind, carries real weight.
 */
export class Ambience {
  private layers: Layer[] = [];
  private creakTimer: number | null = null;
  private current: AmbienceDef | null = null;
  private intensity = 1;

  constructor(private readonly engine: AudioEngine) {}

  private get ctx(): AudioContext | null {
    return this.engine.context;
  }

  /** Crossfades to a new bed. */
  play(def: AmbienceDef): void {
    const ctx = this.ctx;
    if (!ctx) return;
    this.stop(1.4);
    this.current = def;
    this.engine.setSpace(def.space);

    if (def.droneHz > 0) this.layers.push(this.buildDrone(def));
    if (def.wind > 0) this.layers.push(this.buildWind(def));
    if (def.water > 0) this.layers.push(this.buildWater(def));
    if (def.creak > 0) this.scheduleCreaks(def);
  }

  /** Overall ambience level, used to duck under cinematics. */
  setIntensity(value: number): void {
    this.intensity = clamp01(value);
    const ctx = this.ctx;
    if (!ctx) return;
    for (const layer of this.layers) {
      layer.gain.gain.setTargetAtTime(
        (layer.gain as GainNode & { baseGain?: number }).baseGain! * this.intensity,
        ctx.currentTime,
        0.4,
      );
    }
  }

  private makeGain(base: number): GainNode {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, base * this.intensity), ctx.currentTime + 2.4);
    (g as GainNode & { baseGain?: number }).baseGain = base;
    g.connect(this.engine.music);
    const send = ctx.createGain();
    send.gain.value = 0.5;
    g.connect(send);
    send.connect(this.engine.send);
    return g;
  }

  /**
   * The drone. Three detuned sines a fifth apart with very slow beating, plus
   * a sub an octave down. It should be barely audible and deeply unpleasant to
   * lose.
   */
  private buildDrone(def: AmbienceDef): Layer {
    const ctx = this.ctx!;
    const gain = this.makeGain(0.075);
    const sources: OscillatorNode[] = [];
    const nodes: AudioNode[] = [];

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 420;
    lp.Q.value = 0.7;
    lp.connect(gain);
    nodes.push(lp);

    for (const [mult, level, detune] of [
      [0.5, 0.5, 0],
      [1, 1, 4],
      [1.5, 0.42, -7],
      [2.002, 0.22, 11],
    ] as const) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = def.droneHz * mult;
      osc.detune.value = detune;
      const g = ctx.createGain();
      g.gain.value = level * 0.3;

      // Very slow tremolo, different per partial, so the drone never settles.
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.035 + Math.random() * 0.06;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = level * 0.1;
      lfo.connect(lfoGain);
      lfoGain.connect(g.gain);

      osc.connect(g);
      g.connect(lp);
      osc.start();
      lfo.start();
      sources.push(osc, lfo);
      nodes.push(g, lfoGain);
    }
    return { nodes, gain, sources };
  }

  /** Wind: filtered noise with a slowly swept band, gusting. */
  private buildWind(def: AmbienceDef): Layer {
    const ctx = this.ctx!;
    const gain = this.makeGain(0.09 * def.wind);
    const src = ctx.createBufferSource();
    src.buffer = this.engine.noise();
    src.loop = true;

    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 460;
    band.Q.value = 0.9;

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1500;

    // Two LFOs at incommensurate rates: gusts that never repeat audibly.
    const lfo1 = ctx.createOscillator();
    lfo1.frequency.value = 0.062;
    const lfo1g = ctx.createGain();
    lfo1g.gain.value = 280;
    lfo1.connect(lfo1g);
    lfo1g.connect(band.frequency);

    const lfo2 = ctx.createOscillator();
    lfo2.frequency.value = 0.0197;
    const lfo2g = ctx.createGain();
    lfo2g.gain.value = 0.05 * def.wind;
    lfo2.connect(lfo2g);
    lfo2g.connect(gain.gain);

    src.connect(band);
    band.connect(lp);
    lp.connect(gain);
    src.start();
    lfo1.start();
    lfo2.start();
    return { nodes: [band, lp, lfo1g, lfo2g], gain, sources: [src, lfo1, lfo2] };
  }

  /** Water: a low rush plus scheduled drips. */
  private buildWater(def: AmbienceDef): Layer {
    const ctx = this.ctx!;
    const gain = this.makeGain(0.055 * def.water);
    const src = ctx.createBufferSource();
    src.buffer = this.engine.noise();
    src.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 240;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 70;
    src.connect(hp);
    hp.connect(lp);
    lp.connect(gain);
    src.start();
    return { nodes: [lp, hp], gain, sources: [src] };
  }

  /**
   * Creaks and drips, scheduled irregularly.
   *
   * Randomised intervals, never a loop: the moment a player can predict an
   * ambient sound it stops being unsettling and becomes furniture.
   */
  private scheduleCreaks(def: AmbienceDef): void {
    const tick = (): void => {
      const roll = Math.random();
      if (roll < 0.42) {
        // Structural settling.
        this.synthCreak(def);
      } else if (roll < 0.78 && def.water > 0.1) {
        this.synthDrip();
      } else {
        // Something very far away. Never explained.
        this.synthDistant(def);
      }
      const base = 5.5 / Math.max(0.12, def.creak);
      this.creakTimer = window.setTimeout(tick, (base * (0.45 + Math.random() * 1.3)) * 1000);
    };
    this.creakTimer = window.setTimeout(tick, 2600 + Math.random() * 4000);
  }

  private synthCreak(def: AmbienceDef): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    const f0 = 60 + Math.random() * 180;
    osc.frequency.setValueAtTime(f0, t0);
    osc.frequency.linearRampToValueAtTime(f0 * (0.7 + Math.random() * 0.7), t0 + 0.9);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 300 + Math.random() * 900;
    bp.Q.value = 9;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.012 + Math.random() * 0.02, t0 + 0.25);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.1);
    osc.connect(bp);
    bp.connect(g);
    g.connect(this.engine.music);
    const send = ctx.createGain();
    send.gain.value = 0.3 + def.space * 0.5;
    g.connect(send);
    send.connect(this.engine.send);
    osc.start(t0);
    osc.stop(t0 + 1.2);
  }

  private synthDrip(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    const f = 700 + Math.random() * 1400;
    osc.frequency.setValueAtTime(f, t0);
    osc.frequency.exponentialRampToValueAtTime(f * 0.45, t0 + 0.14);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.035, t0 + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.22);
    osc.connect(g);
    g.connect(this.engine.sfx);
    const send = ctx.createGain();
    send.gain.value = 0.8;
    g.connect(send);
    send.connect(this.engine.send);
    osc.start(t0);
    osc.stop(t0 + 0.3);
  }

  private synthDistant(def: AmbienceDef): void {
    const ctx = this.ctx;
    if (!ctx) return;
    // A door, two streets away, in a town with no streets left.
    const t0 = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.engine.noise();
    src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 180 + Math.random() * 320;
    bp.Q.value = 2.4;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.009, t0 + 0.4);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 2.2);
    src.connect(bp);
    bp.connect(g);
    const send = ctx.createGain();
    send.gain.value = 0.6 + def.space * 0.4;
    g.connect(send);
    send.connect(this.engine.send);
    g.connect(this.engine.music);
    src.start(t0);
    src.stop(t0 + 2.4);
  }

  stop(fade = 1.2): void {
    const ctx = this.ctx;
    if (this.creakTimer !== null) {
      window.clearTimeout(this.creakTimer);
      this.creakTimer = null;
    }
    if (!ctx) {
      this.layers = [];
      return;
    }
    const t = ctx.currentTime;
    for (const layer of this.layers) {
      layer.gain.gain.cancelScheduledValues(t);
      layer.gain.gain.setValueAtTime(Math.max(0.0001, layer.gain.gain.value), t);
      layer.gain.gain.exponentialRampToValueAtTime(0.0001, t + fade);
      for (const s of layer.sources) {
        try {
          s.stop(t + fade + 0.1);
        } catch {
          /* already stopped */
        }
      }
    }
    this.layers = [];
  }

  get playing(): AmbienceDef | null {
    return this.current;
  }
}
