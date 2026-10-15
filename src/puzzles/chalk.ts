import type { Puzzle, PuzzleContext } from './types';

/**
 * PUZZLE: The Children's Chalk (symbol interpretation under threat)
 *
 * The ward's floor is marked in chalk by the low-town children, who worked out
 * the lantern's rule the hard way: a closed-mouth glyph where it is safe to be
 * lit, a cross where it is not. The player must cross the ward reading the
 * floor, because the only alternative is crossing it blind.
 *
 * Inputs          `stepOn(index, lit)` - the player entering one of the seven
 *                 floor sections, and whether the beam is on it at the time.
 * Available clues 'clue-chalk', plus the glyphs themselves, which are drawn
 *                 with deliberate clarity rather than as texture. The chalkboard
 *                 in the first room shows the two glyphs side by side.
 * Solution        Traverse sections 0..6. Lighting a 'hush' section is safe.
 *                 Lighting a 'cross' section wakes the Drowned standing on it.
 *                 Crossing a 'cross' section unlit is safe.
 * Transitions     Per-section: 'unknown' -> 'read' once stepped on. The
 *                 puzzle completes when section 6 is reached.
 * Failure         Lighting a cross section wakes a Drowned. That is a chase,
 *                 not a death - dousing the lamp and staying still ends it.
 *                 Being caught returns the player to the ward checkpoint with
 *                 the chalk knowledge intact, because the knowledge is in the
 *                 player's head, not in the save file.
 * Completion      Sets `ward-crossed`, opening the stair to the tunnels.
 * Save state      { reached, woke } - highest section reached, and how many
 *                 times a cross was lit.
 * Reset           reached -> 0. The chalk never changes; it is level data.
 * Soft-lock       Impossible. Every section is passable unlit, so a player who
 *                 refuses to use the lantern at all can still cross. That is
 *                 the deliberate fallback: the puzzle is about confidence, not
 *                 about gating.
 */

export type ChalkGlyph = 'hush' | 'cross';

/**
 * The ward floor, west to east. Authored here rather than in the scene so the
 * test suite can assert the unlit route exists without loading PixiJS.
 */
export const WARD_FLOOR: readonly ChalkGlyph[] = [
  'hush',
  'cross',
  'hush',
  'cross',
  'cross',
  'hush',
  'hush',
];

export interface ChalkInput {
  section: number;
  lit: boolean;
}

export class ChalkPuzzle implements Puzzle<ChalkInput> {
  readonly id = 'puzzle-chalk';
  readonly title = "The Children's Chalk";
  readonly solvedFlag = 'ward-crossed';

  private reached = 0;
  private woke = 0;

  load(ctx: PuzzleContext): void {
    const record = ctx.state.getPuzzle(this.id);
    this.reached = typeof record.reached === 'number' ? record.reached : 0;
    this.woke = typeof record.woke === 'number' ? record.woke : 0;
  }

  /** Does lighting this section wake something? */
  static wakes(section: number, lit: boolean): boolean {
    if (!lit) return false;
    const glyph = WARD_FLOOR[section];
    return glyph === 'cross';
  }

  input(ctx: PuzzleContext, input: ChalkInput): boolean {
    if (this.isSolved(ctx)) return false;
    const section = Math.round(input.section);
    if (section < 0 || section >= WARD_FLOOR.length) return false;

    let changed = false;
    if (section > this.reached) {
      this.reached = section;
      changed = true;
      ctx.onFeedback(this.id, 'progress');
    }
    if (ChalkPuzzle.wakes(section, input.lit)) {
      this.woke++;
      changed = true;
      ctx.onFeedback(this.id, 'reject');
    }
    if (section >= WARD_FLOOR.length - 1) {
      ctx.state.setFlag(this.solvedFlag);
      ctx.onSolved(this.id);
      changed = true;
    }
    if (changed) ctx.state.setPuzzle(this.id, { reached: this.reached, woke: this.woke });
    return changed;
  }

  isSolved(ctx: PuzzleContext): boolean {
    return ctx.state.hasFlag(this.solvedFlag);
  }

  progress(ctx: PuzzleContext): number {
    if (this.isSolved(ctx)) return 1;
    return this.reached / (WARD_FLOOR.length - 1);
  }

  reset(ctx: PuzzleContext): void {
    this.reached = 0;
    ctx.state.setFlag(this.solvedFlag, false);
    ctx.state.setPuzzle(this.id, { reached: 0, woke: this.woke });
  }

  get wakeCount(): number {
    return this.woke;
  }

  softlockRisk(): string | null {
    // The whole floor must be crossable with the lamp off.
    const blockedUnlit = WARD_FLOOR.some((_, i) => ChalkPuzzle.wakes(i, false));
    return blockedUnlit ? 'A ward section cannot be crossed unlit.' : null;
  }
}
