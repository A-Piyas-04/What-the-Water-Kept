import type { GameState } from '@/gameplay/state';

/**
 * Puzzle contract.
 *
 * Every puzzle in the game is a small object with explicit inputs, an explicit
 * completion test, and a serialisable record. PART 7.3 of the brief asks for
 * each puzzle's inputs, solution, transitions, failure behaviour, save
 * representation, reset behaviour and soft-lock analysis to be documented -
 * each implementation carries that documentation in its header, and the
 * `softlockRisk` method is machine-checkable in the test suite.
 */
export interface PuzzleContext {
  state: GameState;
  /** Fired when the puzzle resolves; the scene reacts (doors, lamps, audio). */
  onSolved: (id: string) => void;
  /** Fired on a wrong-but-legal input, for feedback. */
  onFeedback: (id: string, kind: 'step' | 'reject' | 'progress') => void;
}

export interface Puzzle<Input = unknown> {
  readonly id: string;
  /** Human-readable, for the test report. */
  readonly title: string;
  /** Flag set when solved. Scene data keys doors and lamps off this. */
  readonly solvedFlag: string;

  /** Restores from the save record. */
  load(ctx: PuzzleContext): void;
  /** Applies one player input. Returns true if the puzzle state changed. */
  input(ctx: PuzzleContext, input: Input): boolean;
  /** Is it finished? */
  isSolved(ctx: PuzzleContext): boolean;
  /** Current progress 0..1, for subtle UI feedback. */
  progress(ctx: PuzzleContext): number;
  /** Puts it back to the start. Used by "restart chapter" and by tests. */
  reset(ctx: PuzzleContext): void;

  /**
   * Returns a non-empty string if the puzzle can be put into a state that
   * blocks progression. Every puzzle must return null, and a test asserts it.
   */
  softlockRisk(ctx: PuzzleContext): string | null;
}
