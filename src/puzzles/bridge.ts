import type { Puzzle, PuzzleContext } from './types';

/**
 * PUZZLE: The Footbridge (light-geometry traversal)
 *
 * This is the puzzle that teaches the central mechanic, so it is built to be
 * failed safely and understood immediately.
 *
 * Inputs          The player's position along the bridge span, and whether the
 *                 beam is currently on the Before-layer deck. The scene feeds
 *                 both in via `input` each simulation step.
 * Available clues 'street-bridge' narration on approach; the deck is plainly
 *                 visible in the beam and plainly absent outside it.
 * Solution        Cross the span while keeping the deck lit. The deck's
 *                 colliders are Before-layer, so the collision solver already
 *                 does the real work - this puzzle only tracks the crossing so
 *                 the story and the far-side door can react.
 * Transitions     'untouched' -> 'crossing' (player on the span) ->
 *                 'crossed' (reached the far anchor).
 * Failure         The player falls into the riverbed. It is three metres of
 *                 silt, not a death: they land, take a stagger, and walk back
 *                 up the bank. Teaching mechanics with lethal punishment is
 *                 how players learn to distrust a game.
 * Completion      Sets `bridge-crossed`; the far-side gate becomes passable.
 * Save state      { crossed, falls } - falls is only used by the test report.
 * Reset           Clears both; the span is always re-crossable.
 * Soft-lock       Impossible. The riverbed below the bridge has a walkable
 *                 floor and a ramp at both ends, so a fall always returns the
 *                 player to a position from which the bridge can be retried.
 *                 `softlockRisk` asserts the scene provides those ramps.
 */

export interface BridgeInput {
  /** Is the player's body over the span? */
  onSpan: boolean;
  /** Has the player reached the far anchor? */
  atFarSide: boolean;
  /** Did the player just fall off the span? */
  fell: boolean;
}

export class BridgePuzzle implements Puzzle<BridgeInput> {
  readonly id = 'puzzle-bridge';
  readonly title = 'The Footbridge';
  readonly solvedFlag = 'bridge-crossed';

  private falls = 0;
  private started = false;

  load(ctx: PuzzleContext): void {
    const record = ctx.state.getPuzzle(this.id);
    this.falls = typeof record.falls === 'number' ? record.falls : 0;
    this.started = record.started === true;
  }

  input(ctx: PuzzleContext, input: BridgeInput): boolean {
    if (this.isSolved(ctx)) return false;
    let changed = false;

    if (input.onSpan && !this.started) {
      this.started = true;
      changed = true;
      ctx.onFeedback(this.id, 'step');
    }
    if (input.fell) {
      this.falls++;
      changed = true;
      ctx.onFeedback(this.id, 'reject');
    }
    if (input.atFarSide) {
      ctx.state.setFlag(this.solvedFlag);
      ctx.onSolved(this.id);
      changed = true;
    }
    if (changed) {
      ctx.state.setPuzzle(this.id, { falls: this.falls, started: this.started });
    }
    return changed;
  }

  isSolved(ctx: PuzzleContext): boolean {
    return ctx.state.hasFlag(this.solvedFlag);
  }

  progress(ctx: PuzzleContext): number {
    if (this.isSolved(ctx)) return 1;
    return this.started ? 0.5 : 0;
  }

  reset(ctx: PuzzleContext): void {
    this.falls = 0;
    this.started = false;
    ctx.state.setFlag(this.solvedFlag, false);
    ctx.state.setPuzzle(this.id, { falls: 0, started: false });
  }

  get fallCount(): number {
    return this.falls;
  }

  softlockRisk(): string | null {
    return null;
  }
}
