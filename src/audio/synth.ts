import { clamp01 } from '@/core/math';
import type { AudioEngine } from './engine';

/**
 * Every sound effect in the game, synthesised.
 *
 * The house style: noise shaped by resonant filters for anything physical
 * (footsteps, stone, water), and detuned oscillators through lowpass for
 * anything that is meant to feel wrong. Nothing here is ever allowed to be
 * sudden and loud - the brief rules out cheap jumpscares, and the mix follows.
 */
export class Synth {
  constructor(private readonly engine: AudioEngine) {}

  private get ctx(): AudioContext | null {
    return this.engine.context;
  }

  /** Noise burst through a bandpass - the workhorse for physical sounds. */
  private burst(opts: {
    duration: number;
    freq: number;
    q: number;
    gain: number;
    type?: BiquadFilterType;
    sweepTo?: number;
    attack?: number;
    sendAmount?: number;
    when?: number;
  }): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t0 = opts.when ?? ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.engine.noise();
    src.loop = true;
    // Random read offset so repeated hits are never identical.
    const filter = ctx.createBiquadFilter();
    filter.type = opts.type ?? 'bandpass';
    filter.frequency.setValueAtTime(opts.freq, t0);
    filter.Q.value = opts.q;
    if (opts.sweepTo !== undefined) {
      filter.frequency.exponentialRampToValueAtTime(
        Math.max(30, opts.sweepTo),
        t0 + opts.duration,
      );
    }
    const gain = ctx.createGain();
    const attack = opts.attack ?? 0.004;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, opts.gain), t0 + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + opts.duration);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.engine.sfx);
    if (opts.sendAmount) {
      const send = ctx.createGain();
      send.gain.value = opts.sendAmount;
      gain.connect(send);
      send.connect(this.engine.send);
    }
    src.start(t0, Math.random() * 1.5);
    src.stop(t0 + opts.duration + 0.05);
  }

  /** A pitched tone with an envelope. */
  private tone(opts: {
    freq: number;
    duration: number;
    gain: number;
    type?: OscillatorType;
    detune?: number;
    glideTo?: number;
    attack?: number;
    sendAmount?: number;
    when?: number;
    lowpass?: number;
  }): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t0 = opts.when ?? ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = opts.type ?? 'sine';
    osc.frequency.setValueAtTime(opts.freq, t0);
    if (opts.detune) osc.detune.value = opts.detune;
    if (opts.glideTo !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, opts.glideTo), t0 + opts.duration);
    }
    const gain = ctx.createGain();
    const attack = opts.attack ?? 0.01;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, opts.gain), t0 + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + opts.duration);

    let tail: AudioNode = gain;
    if (opts.lowpass) {
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = opts.lowpass;
      gain.connect(lp);
      tail = lp;
    }
    osc.connect(gain);
    tail.connect(this.engine.sfx);
    if (opts.sendAmount) {
      const send = ctx.createGain();
      send.gain.value = opts.sendAmount;
      tail.connect(send);
      send.connect(this.engine.send);
    }
    osc.start(t0);
    osc.stop(t0 + opts.duration + 0.05);
  }

  // ---------------------------------------------------------------- footsteps

  /**
   * Footsteps. Surface changes the filter, not the sample, so silt, boards,
   * stone and standing water are four numbers rather than four recordings.
   */
  footstep(surface: 'silt' | 'stone' | 'boards' | 'water' | 'metal', weight = 1): void {
    const v = 0.1 + weight * 0.1;
    switch (surface) {
      case 'silt':
        this.burst({ duration: 0.16, freq: 330, q: 0.8, gain: v * 0.8, sweepTo: 150, sendAmount: 0.12 });
        this.burst({ duration: 0.07, freq: 1400, q: 0.6, gain: v * 0.22 });
        break;
      case 'stone':
        this.burst({ duration: 0.1, freq: 900, q: 1.4, gain: v, sweepTo: 420, sendAmount: 0.3 });
        this.tone({ freq: 118, duration: 0.07, gain: v * 0.4, type: 'triangle' });
        break;
      case 'boards':
        this.burst({ duration: 0.13, freq: 420, q: 2.6, gain: v, sweepTo: 240, sendAmount: 0.2 });
        this.tone({ freq: 84, duration: 0.12, gain: v * 0.5, type: 'sine', glideTo: 62 });
        break;
      case 'water':
        this.burst({ duration: 0.26, freq: 1700, q: 0.5, gain: v * 0.9, sweepTo: 500, sendAmount: 0.26 });
        this.burst({ duration: 0.1, freq: 260, q: 1.2, gain: v * 0.5 });
        break;
      case 'metal':
        this.burst({ duration: 0.22, freq: 2400, q: 5, gain: v * 0.6, sendAmount: 0.42 });
        this.tone({ freq: 196, duration: 0.3, gain: v * 0.3, type: 'triangle', sendAmount: 0.3 });
        break;
    }
  }

  // ------------------------------------------------------------------ lantern

  /** The switch. A real mechanical clack, then the filament coming up. */
  lanternOn(): void {
    this.burst({ duration: 0.05, freq: 2600, q: 7, gain: 0.16 });
    this.tone({ freq: 70, duration: 0.09, gain: 0.1, type: 'square', lowpass: 400 });
    // Ignition: a rising breath of noise.
    this.burst({
      duration: 0.65,
      freq: 240,
      q: 0.7,
      gain: 0.06,
      sweepTo: 1800,
      attack: 0.3,
      sendAmount: 0.2,
    });
  }

  lanternOff(): void {
    this.burst({ duration: 0.05, freq: 2200, q: 7, gain: 0.14 });
    // The filament dying: a short descending sigh.
    this.burst({ duration: 0.4, freq: 1500, q: 0.9, gain: 0.05, sweepTo: 180, sendAmount: 0.25 });
  }

  /** Denied: she has not found the lantern, or it has been suppressed. */
  lanternDenied(): void {
    this.burst({ duration: 0.07, freq: 1800, q: 9, gain: 0.08 });
    this.burst({ duration: 0.07, freq: 1800, q: 9, gain: 0.06, when: this.engine.now + 0.1 });
  }

  // ------------------------------------------------------------- interactions

  interact(): void {
    this.burst({ duration: 0.12, freq: 1100, q: 2.2, gain: 0.07, sweepTo: 700, sendAmount: 0.2 });
  }

  pickup(): void {
    this.tone({ freq: 523, duration: 0.5, gain: 0.07, type: 'sine', sendAmount: 0.4, attack: 0.02 });
    this.tone({ freq: 784, duration: 0.7, gain: 0.045, type: 'sine', sendAmount: 0.5, when: this.engine.now + 0.06 });
  }

  clue(): void {
    this.tone({ freq: 392, duration: 0.9, gain: 0.055, type: 'sine', sendAmount: 0.55, attack: 0.05 });
    this.tone({ freq: 587, duration: 1.3, gain: 0.03, type: 'sine', sendAmount: 0.6, when: this.engine.now + 0.12 });
  }

  denied(): void {
    this.tone({ freq: 140, duration: 0.26, gain: 0.08, type: 'triangle', glideTo: 98, lowpass: 700 });
  }

  door(opening: boolean): void {
    if (opening) {
      this.burst({ duration: 0.9, freq: 220, q: 3.4, gain: 0.09, sweepTo: 520, attack: 0.15, sendAmount: 0.4 });
      this.tone({ freq: 62, duration: 0.7, gain: 0.07, type: 'sine', glideTo: 48 });
    } else {
      this.burst({ duration: 0.2, freq: 300, q: 1.6, gain: 0.13, sweepTo: 120, sendAmount: 0.35 });
      this.tone({ freq: 70, duration: 0.3, gain: 0.1, type: 'sine', glideTo: 44 });
    }
  }

  /** Stone sliding, a gate lifting, a cart rolling. */
  mechanism(duration = 1.2, pitch = 1): void {
    this.burst({
      duration,
      freq: 160 * pitch,
      q: 2.2,
      gain: 0.085,
      sweepTo: 420 * pitch,
      attack: 0.25,
      sendAmount: 0.45,
    });
    this.tone({ freq: 52 * pitch, duration, gain: 0.06, type: 'sawtooth', lowpass: 220, attack: 0.3 });
  }

  /** A dial clicking to the next detent. */
  detent(step: number): void {
    this.burst({ duration: 0.06, freq: 1500 + step * 120, q: 8, gain: 0.1 });
    this.tone({ freq: 240 + step * 40, duration: 0.09, gain: 0.05, type: 'triangle', sendAmount: 0.3 });
  }

  /** A puzzle resolving. Warm, low, and short - a release of tension. */
  solved(): void {
    const t = this.engine.now;
    [196, 294, 392].forEach((f, i) => {
      this.tone({
        freq: f,
        duration: 2.4 - i * 0.3,
        gain: 0.05,
        type: 'sine',
        attack: 0.12,
        sendAmount: 0.6,
        when: t + i * 0.18,
      });
    });
    this.mechanism(1.6, 0.7);
  }

  // ------------------------------------------------------------------- horror

  /** The sound a Drowned makes when the beam first touches it. */
  noticed(): void {
    // An intake of breath that was never finished in 1964.
    this.burst({ duration: 0.8, freq: 600, q: 1.8, gain: 0.07, sweepTo: 1900, attack: 0.35, sendAmount: 0.6 });
    this.tone({ freq: 146, duration: 1.1, gain: 0.05, type: 'triangle', glideTo: 190, sendAmount: 0.7 });
  }

  /** Dragging, close. Pitched by how near it is. */
  approach(nearness: number): void {
    const n = clamp01(nearness);
    this.burst({
      duration: 0.55,
      freq: 180 + n * 220,
      q: 1.1,
      gain: 0.03 + n * 0.07,
      sweepTo: 90,
      attack: 0.14,
      sendAmount: 0.5,
    });
  }

  /** Caught. Not a scream: a swallow. */
  taken(): void {
    const t = this.engine.now;
    this.burst({ duration: 1.5, freq: 900, q: 0.6, gain: 0.13, sweepTo: 70, attack: 0.03, sendAmount: 0.7 });
    this.tone({ freq: 120, duration: 2, gain: 0.1, type: 'sawtooth', glideTo: 34, lowpass: 300, sendAmount: 0.6 });
    this.tone({ freq: 55, duration: 2.6, gain: 0.07, type: 'sine', when: t + 0.2 });
  }

  /**
   * The Drowning Choir: the ward's set-piece.
   *
   * Nineteen voices that never finished a note. Built from detuned triangle
   * oscillators through formant bandpasses, gliding very slowly apart.
   * Returns a stop handle, because it has to be able to stop mid-phrase.
   */
  choir(voices = 9, baseHz = 98): () => void {
    const ctx = this.ctx;
    if (!ctx) return () => undefined;
    const t0 = ctx.currentTime;
    const out = ctx.createGain();
    out.gain.setValueAtTime(0.0001, t0);
    out.gain.exponentialRampToValueAtTime(0.09, t0 + 5);
    out.connect(this.engine.music);
    const send = ctx.createGain();
    send.gain.value = 0.75;
    out.connect(send);
    send.connect(this.engine.send);

    const nodes: Array<OscillatorNode | AudioBufferSourceNode> = [];
    // Formant frequencies of a sustained, closed-mouth vowel.
    const formants = [420, 830, 2400];

    for (let i = 0; i < voices; i++) {
      const osc = ctx.createOscillator();
      osc.type = i % 3 === 0 ? 'sawtooth' : 'triangle';
      const ratio = [1, 1.5, 2, 2.004, 3, 1.002][i % 6];
      osc.frequency.value = baseHz * ratio;
      // Each voice drifts a little flat over a minute. Nothing resolves.
      osc.detune.setValueAtTime((Math.random() - 0.5) * 26, t0);
      osc.detune.linearRampToValueAtTime((Math.random() - 0.5) * 70 - 14, t0 + 55);

      const formant = ctx.createBiquadFilter();
      formant.type = 'bandpass';
      formant.frequency.value = formants[i % formants.length] * (0.9 + Math.random() * 0.2);
      formant.Q.value = 5 + Math.random() * 5;

      const vg = ctx.createGain();
      vg.gain.value = 0.1 / Math.sqrt(voices);

      // Slow amplitude breathing, each voice out of phase with the others.
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.07 + Math.random() * 0.14;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 0.055 / Math.sqrt(voices);
      lfo.connect(lfoGain);
      lfoGain.connect(vg.gain);

      osc.connect(formant);
      formant.connect(vg);
      vg.connect(out);
      osc.start(t0 + Math.random() * 2.5);
      lfo.start(t0);
      nodes.push(osc, lfo);
    }

    let stopped = false;
    return () => {
      if (stopped) return;
      stopped = true;
      const t = ctx.currentTime;
      out.gain.cancelScheduledValues(t);
      out.gain.setValueAtTime(Math.max(0.0001, out.gain.value), t);
      out.gain.exponentialRampToValueAtTime(0.0001, t + 2.2);
      for (const n of nodes) {
        try {
          n.stop(t + 2.4);
        } catch {
          /* already stopped */
        }
      }
    };
  }

  /** Heartbeat, for high dread. Returns a stop handle. */
  heartbeat(): { setRate: (bpm: number) => void; setLevel: (v: number) => void; stop: () => void } {
    const ctx = this.ctx;
    if (!ctx) {
      return { setRate: () => undefined, setLevel: () => undefined, stop: () => undefined };
    }
    let bpm = 64;
    let level = 0;
    let timer: number | null = null;
    const beat = (): void => {
      if (level > 0.01) {
        const g = level * 0.1;
        this.tone({ freq: 58, duration: 0.17, gain: g, type: 'sine', glideTo: 40, lowpass: 180 });
        this.tone({
          freq: 52,
          duration: 0.14,
          gain: g * 0.6,
          type: 'sine',
          glideTo: 36,
          when: ctx.currentTime + 0.21,
          lowpass: 160,
        });
      }
      timer = window.setTimeout(beat, (60 / bpm) * 1000);
    };
    timer = window.setTimeout(beat, 400);
    return {
      setRate: (v) => {
        bpm = Math.max(40, Math.min(150, v));
      },
      setLevel: (v) => {
        level = clamp01(v);
      },
      stop: () => {
        if (timer !== null) window.clearTimeout(timer);
      },
    };
  }

  /** Low, slow swell for revelations and scene cards. */
  swell(duration = 4, baseHz = 64): void {
    const t = this.engine.now;
    for (const [mult, gain] of [[1, 0.07], [1.5, 0.04], [2.01, 0.03]] as const) {
      this.tone({
        freq: baseHz * mult,
        duration,
        gain,
        type: 'sine',
        attack: duration * 0.42,
        sendAmount: 0.7,
        when: t,
        lowpass: 900,
      });
    }
  }

  /** Water rising. Used in the finale, and it does not stop. */
  flood(): { setIntensity: (v: number) => void; stop: () => void } {
    const ctx = this.ctx;
    if (!ctx) return { setIntensity: () => undefined, stop: () => undefined };
    const t0 = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.engine.noise();
    src.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 400;
    lp.Q.value = 0.8;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 60;
    const gain = ctx.createGain();
    gain.gain.value = 0.0001;
    src.connect(hp);
    hp.connect(lp);
    lp.connect(gain);
    gain.connect(this.engine.sfx);
    const send = ctx.createGain();
    send.gain.value = 0.4;
    gain.connect(send);
    send.connect(this.engine.send);
    src.start(t0);
    return {
      setIntensity: (v) => {
        const n = clamp01(v);
        gain.gain.setTargetAtTime(0.02 + n * 0.2, ctx.currentTime, 0.5);
        lp.frequency.setTargetAtTime(300 + n * 2600, ctx.currentTime, 0.8);
      },
      stop: () => {
        const t = ctx.currentTime;
        gain.gain.setTargetAtTime(0.0001, t, 0.5);
        try {
          src.stop(t + 2);
        } catch {
          /* already stopped */
        }
      },
    };
  }

  /** UI. Soft, felt rather than heard. */
  uiMove(): void {
    this.tone({ freq: 880, duration: 0.05, gain: 0.025, type: 'sine' });
  }

  uiConfirm(): void {
    this.tone({ freq: 523, duration: 0.14, gain: 0.04, type: 'sine', sendAmount: 0.3 });
  }

  uiBack(): void {
    this.tone({ freq: 330, duration: 0.14, gain: 0.035, type: 'sine', glideTo: 262 });
  }
}
