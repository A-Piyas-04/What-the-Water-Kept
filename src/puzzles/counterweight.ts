import { clamp } from '@/core/math';
import type { Puzzle, PuzzleContext } from './types';

/**
 * PUZZLE: The Counterweight Cart (object manipulation + light-geometry)
 *
 * The tunnel's spoil cart must be sent up a graded rail to hold a collapsed
 * roof beam clear of the passage. The rail and the winch cable only exist in
 * 1964, so the cart will only move while the beam is on the rail - and the
 * player cannot both crank the winch and hold the beam on the far end of the
 * rail at the same time. The answer is to use the cart's own momentum: wind it
 * up in stages, letting it coast while the beam is elsewhere.
 *
 * Inputs          `crank(lit)` once per interaction while holding the winch,
 *                 and `tick(dt, lit)` every simulation step.
 * Available clues 'tunnels-cart' narration; the rail is visibly graded, and the
 *                 winch ratchet audibly holds between cranks.
 * Solution        Raise the cart to position 1.0. Each crank adds 0.22 while
 *                 the rail is lit. While unlit, the ratchet holds the cart in
 *                 place - it does not run back. So the solution is simply:
 *                 light the rail, crank, repeat. The "trick" is realising the
 *                 ratchet means you never lose progress.
 * Transitions     position 0 -> 1 in discrete cranks; at 1.0 the beam lifts.
 * Failure         Cranking with the rail unlit does nothing and says so
 *                 (a dry ratchet click). There is no way to damage the state.
 * Completion      Sets `tunnel-beam-raised`, clearing the passage collider.
 * Save state      { position, cranks }.
 * Reset           position -> 0.
 * Soft-lock       Impossible: the ratchet is monotonic, so position never
 *                 decreases and the puzzle cannot be driven away from its
 *                 solution. `softlockRisk` asserts monotonicity.
 */

export interface CrankInput {
  kind: 'crank';
  lit: boolean;
}

export interface TickInput {
  kind: 'tick';
  dt: number;
  lit: boolean;
}

export type CounterweightInput = CrankInput | TickInput;

const CRANK_STEP = 0.22;
/** How fast the cart visually catches up to its ratcheted position. */
const SETTLE_RATE = 1.6;

export class CounterweightPuzzle implements Puzzle<CounterweightInput> {
  readonly id = 'puzzle-counterweight';
  readonly title = 'The Counterweight Cart';
  readonly solvedFlag = 'tunnel-beam-raised';

  /** Ratcheted target, 0..1. Monotonically non-decreasing. */
  private position = 0;
  /** Smoothed visual position, for rendering. */
  private visual = 0;
  private cranks = 0;

  load(ctx: PuzzleContext): void {
    const record = ctx.state.getPuzzle(this.id);
    this.position = clamp(typeof record.position === 'number' ? record.position : 0, 0, 1);
    this.visual = this.position;
    this.cranks = typeof record.cranks === 'number' ? record.cranks : 0;
    if (ctx.state.hasFlag(this.solvedFlag)) {
      this.position = 1;
      this.visual = 1;
    }
  }

  input(ctx: PuzzleContext, input: CounterweightInput): boolean {
    if (input.kind === 'tick') {
      const before = this.visual;
      this.visual += (this.position - this.visual) * Math.min(1, input.dt * SETTLE_RATE);
      return Math.abs(this.visual - before) > 0.0001;
    }

    if (this.isSolved(ctx)) return false;
    if (!input.lit) {
      // The rail is not there to crank against.
      ctx.onFeedback(this.id, 'reject');
      return false;
    }

    this.cranks++;
    this.position = clamp(this.position + CRANK_STEP, 0, 1);
    ctx.onFeedback(this.id, 'step');
    ctx.state.setPuzzle(this.id, { position: this.position, cranks: this.cranks });

    if (this.position >= 0.999) {
      ctx.state.setFlag(this.solvedFlag);
      ctx.onSolved(this.id);
    }
    return true;
  }

  /** 0..1, for drawing the cart and the counterweight. */
  get visualPosition(): number {
    return this.visual;
  }

  get crankCount(): number {
    return this.cranks;
  }

  isSolved(ctx: PuzzleContext): boolean {
    return ctx.state.hasFlag(this.solvedFlag);
  }

  progress(ctx: PuzzleContext): number {
    return this.isSolved(ctx) ? 1 : this.position;
  }

  reset(ctx: PuzzleContext): void {
    this.position = 0;
    this.visual = 0;
    this.cranks = 0;
    ctx.state.setFlag(this.solvedFlag, false);
    ctx.state.setPuzzle(this.id, { position: 0, cranks: 0 });
  }

  softlockRisk(): string | null {
    // The only mutator adds a positive step and clamps at 1.
    return CRANK_STEP > 0 ? null : 'Crank step is not positive.';
  }
}
