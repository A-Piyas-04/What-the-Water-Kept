import type { Puzzle, PuzzleContext } from './types';

/**
 * PUZZLE: The Sluice Dials (narrative deduction)
 *
 * Inputs          Three dials, each turned one detent at a time by the player.
 *                 Twelve detents per dial, representing the hours of a clock
 *                 face; the dial reads as a time to the nearest five minutes.
 * Available clues 'clue-ledger' records three times from the gate ledger
 *                 (2140, 2144, 2151). 'clue-clocks' records that three stopped
 *                 clocks hang above the three dials, each showing one of those
 *                 times - so the clue tells you which time goes on which dial.
 * Solution        Dial 0 -> 2140, dial 1 -> 2144, dial 2 -> 2151, encoded as
 *                 detent indices below.
 * Transitions     Each turn advances one dial and emits a detent click. When
 *                 all three match, the puzzle resolves once.
 * Failure         There is none. Wrong combinations simply are not the answer;
 *                 nothing resets, nothing punishes, and the dials can be
 *                 turned freely forever.
 * Completion      Sets `gate-log-open`, which reveals the gate log interactable.
 * Save state      { d0, d1, d2, solved } in the puzzle record.
 * Reset           All dials to 0, solved cleared.
 * Soft-lock       Impossible: the dials are cyclic, so every position is
 *                 reachable from every other position by turning.
 */

export interface SluiceInput {
  /** Which dial, 0..2. */
  dial: number;
}

/** Detent index for each dial's target, over 12 detents. */
const SOLUTION = [8, 9, 11] as const;
const DETENTS = 12;

/** Dial index -> the time it should be set to, for the UI. */
export const DIAL_TIMES: readonly string[] = ['21:40', '21:44', '21:51'];

/** Detent index -> label shown on the dial. */
export const detentLabel = (detent: number): string => {
  // Twelve detents spanning 21:00 to 22:00 in five-minute steps.
  const minutes = (detent % DETENTS) * 5;
  return `21:${minutes.toString().padStart(2, '0')}`;
};

export class SluicePuzzle implements Puzzle<SluiceInput> {
  readonly id = 'puzzle-sluice';
  readonly title = 'The Sluice Dials';
  readonly solvedFlag = 'gate-log-open';

  private dials: [number, number, number] = [0, 0, 0];

  load(ctx: PuzzleContext): void {
    const record = ctx.state.getPuzzle(this.id);
    this.dials = [
      this.sanitise(record.d0),
      this.sanitise(record.d1),
      this.sanitise(record.d2),
    ];
  }

  private sanitise(value: unknown): number {
    const n = typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : 0;
    return ((n % DETENTS) + DETENTS) % DETENTS;
  }

  private persist(ctx: PuzzleContext): void {
    ctx.state.setPuzzle(this.id, {
      d0: this.dials[0],
      d1: this.dials[1],
      d2: this.dials[2],
      solved: this.matches(),
    });
  }

  private matches(): boolean {
    return this.dials.every((d, i) => d === SOLUTION[i]);
  }

  input(ctx: PuzzleContext, input: SluiceInput): boolean {
    if (this.isSolved(ctx)) return false;
    const i = Math.round(input.dial);
    if (i < 0 || i > 2) return false;

    this.dials[i] = (this.dials[i] + 1) % DETENTS;
    ctx.onFeedback(this.id, 'step');
    this.persist(ctx);

    if (this.matches()) {
      ctx.state.setFlag(this.solvedFlag);
      ctx.onSolved(this.id);
    } else if (this.correctCount() === 2) {
      // One dial away: a quiet cue so the player knows they are close.
      ctx.onFeedback(this.id, 'progress');
    }
    return true;
  }

  private correctCount(): number {
    return this.dials.filter((d, i) => d === SOLUTION[i]).length;
  }

  /** Current detent of a dial, for rendering. */
  dialAt(index: number): number {
    return this.dials[Math.max(0, Math.min(2, index))];
  }

  isSolved(ctx: PuzzleContext): boolean {
    return ctx.state.hasFlag(this.solvedFlag);
  }

  progress(ctx: PuzzleContext): number {
    return this.isSolved(ctx) ? 1 : this.correctCount() / 3;
  }

  reset(ctx: PuzzleContext): void {
    this.dials = [0, 0, 0];
    ctx.state.setFlag(this.solvedFlag, false);
    this.persist(ctx);
  }

  softlockRisk(): string | null {
    // Cyclic dials with no fail state and no consumable inputs.
    return null;
  }
}
