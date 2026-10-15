import type { PoseName } from '@/rendering/character';

/**
 * Scripted sequences.
 *
 * A cinematic is a list of steps run on the fixed-timestep clock. It is
 * deliberately not a coroutine library: every step is data, so a sequence can
 * be interrupted, skipped, or - importantly - abandoned safely when the player
 * dies or backgrounds the app mid-cinematic, by simply dropping the step list
 * and restoring control.
 */
export interface CinematicStep {
  /** Seconds this step lasts. 0 runs it and moves on in the same frame. */
  readonly hold?: number;
  /** Letterbox bars 0..1. */
  readonly bars?: number;
  /** Narration to show. The step waits for the player to dismiss it. */
  readonly textId?: string;
  /** Camera framing override. */
  readonly camera?: { zoom?: number; offsetX?: number; offsetY?: number; lockX?: number };
  /** Release the camera back to following the player. */
  readonly releaseCamera?: boolean;
  /** Takes the body away from the player. */
  readonly lock?: boolean;
  /** Pose while locked. */
  readonly pose?: PoseName;
  /** Walk the player to a world X at this speed (px/s). */
  readonly walkTo?: { x: number; speed: number };
  /** Set a flag. */
  readonly flag?: string;
  /** Fade to black 0..1. */
  readonly fade?: number;
  /** Named audio cue, handled by the director. */
  readonly audio?: string;
  /** Camera shake magnitude. */
  readonly shake?: number;
  /** Force the lantern off/on for the sequence. */
  readonly lantern?: 'off' | 'on' | 'suppress' | 'release';
  /** Ends the game with this ending id. */
  readonly ending?: string;
}

export interface CinematicDef {
  readonly id: string;
  readonly steps: readonly CinematicStep[];
  /** Can the player skip it? Story beats yes; the ending no. */
  readonly skippable?: boolean;
}

export const CINEMATICS: Readonly<Record<string, CinematicDef>> = {
  /** Entering the ward: the choir fades up out of nothing. */
  'ward-enter': {
    id: 'ward-enter',
    skippable: true,
    steps: [
      { bars: 1, lock: true, pose: 'idle', hold: 0.6 },
      { camera: { zoom: 1.12, offsetY: -30 }, hold: 1.4 },
      { releaseCamera: true, bars: 0, lock: false, hold: 0.3 },
    ],
  },

  /** The choir begins. Audio-led: the picture barely changes. */
  'choir-start': {
    id: 'choir-start',
    skippable: true,
    steps: [
      { bars: 1, lock: true, pose: 'fear', audio: 'choir-on', hold: 1.2 },
      { camera: { zoom: 0.96, offsetY: -20 }, hold: 2.2 },
      { textId: 'ward-choir' },
      { releaseCamera: true, bars: 0, lock: false, hold: 0.4 },
    ],
  },

  /** The revelation at the gatehouse window. */
  revelation: {
    id: 'revelation',
    skippable: false,
    steps: [
      { bars: 1, lock: true, pose: 'idle', hold: 0.5 },
      { camera: { zoom: 1.2, offsetX: 60, offsetY: -30 }, audio: 'swell', hold: 2.4 },
      { textId: 'gate-revelation' },
      { camera: { zoom: 0.92, offsetY: -10 }, hold: 1.6 },
      { flag: 'knows-everything', releaseCamera: true, bars: 0, lock: false, hold: 0.3 },
    ],
  },

  /** The finale begins: the gate is already moving. */
  'finale-start': {
    id: 'finale-start',
    skippable: true,
    steps: [
      { bars: 1, lock: true, pose: 'idle', fade: 1, hold: 0.4 },
      { fade: 0, camera: { zoom: 0.8, offsetY: -120 }, audio: 'flood-on', hold: 2.2 },
      { shake: 3, audio: 'gate-moving', hold: 1.4 },
      { textId: 'finale-arrive' },
      { releaseCamera: true, bars: 0, lock: false, hold: 0.4 },
    ],
  },

  /** Showing Martin the log. The warm ending. */
  'ending-shown': {
    id: 'ending-shown',
    skippable: false,
    steps: [
      { bars: 1, lock: true, pose: 'reach', camera: { zoom: 1.3, offsetX: -30 }, hold: 1.6 },
      { lantern: 'on', audio: 'swell', hold: 1.2 },
      { pose: 'kneel', hold: 1.8 },
      { textId: 'ending-shown' },
      { flag: 'ending-shown', audio: 'flood-up', shake: 2, hold: 1.2 },
      { fade: 1, hold: 2 },
      { ending: 'shown' },
    ],
  },

  /** Walking past him in the dark. The cold ending. */
  'ending-withheld': {
    id: 'ending-withheld',
    skippable: false,
    steps: [
      { bars: 1, lock: true, pose: 'idle', camera: { zoom: 1.1 }, hold: 1.2 },
      { lantern: 'off', hold: 1.4 },
      { textId: 'ending-withheld' },
      { flag: 'ending-withheld', hold: 0.8 },
      { fade: 1, hold: 2 },
      { ending: 'withheld' },
    ],
  },

  /** Reaching the valley side: resolves to whichever ending applies. */
  ending: {
    id: 'ending',
    skippable: false,
    steps: [{ lock: true, bars: 1, hold: 0.2 }],
  },
};

export const getCinematic = (id: string): CinematicDef | null => CINEMATICS[id] ?? null;

/** Runtime state for the currently playing cinematic. */
export class CinematicPlayer {
  private def: CinematicDef | null = null;
  private index = 0;
  private elapsed = 0;
  /** True while a step is waiting for the player to dismiss narration. */
  private waitingForText = false;

  get playing(): boolean {
    return this.def !== null;
  }

  get currentId(): string | null {
    return this.def?.id ?? null;
  }

  get skippable(): boolean {
    return this.def?.skippable ?? false;
  }

  start(def: CinematicDef): void {
    this.def = def;
    this.index = -1;
    this.elapsed = 0;
    this.waitingForText = false;
  }

  /** Called when narration is dismissed. */
  textDismissed(): void {
    this.waitingForText = false;
    this.elapsed = 1e9;
  }

  /**
   * Advances the sequence. `apply` runs a step's effects; the player returns
   * the step it has moved onto, or null when the sequence finishes.
   */
  update(dt: number, apply: (step: CinematicStep) => void): CinematicStep | null {
    if (!this.def) return null;
    if (this.waitingForText) return this.def.steps[this.index] ?? null;

    const steps = this.def.steps;
    if (this.index < 0) {
      this.index = 0;
      this.elapsed = 0;
      const step = steps[0];
      if (!step) {
        this.def = null;
        return null;
      }
      apply(step);
      if (step.textId) this.waitingForText = true;
      return step;
    }

    this.elapsed += dt;
    const current = steps[this.index];
    const hold = current?.hold ?? 0;
    if (this.elapsed < hold) return current;

    this.index++;
    this.elapsed = 0;
    const next = steps[this.index];
    if (!next) {
      this.def = null;
      return null;
    }
    apply(next);
    if (next.textId) this.waitingForText = true;
    return next;
  }

  /** Abandons the sequence. Callers must restore control themselves. */
  stop(): void {
    this.def = null;
    this.index = 0;
    this.elapsed = 0;
    this.waitingForText = false;
  }

  /** Runs every remaining step's effects at once, for the skip button. */
  skip(apply: (step: CinematicStep) => void): void {
    if (!this.def || !this.def.skippable) return;
    for (let i = Math.max(0, this.index); i < this.def.steps.length; i++) {
      const step = this.def.steps[i];
      // Narration is dropped rather than flashed when skipping.
      if (step.textId) continue;
      apply(step);
    }
    this.stop();
  }
}
