import type { Puzzle, PuzzleContext } from './types';
import { BridgePuzzle } from './bridge';
import { ChalkPuzzle } from './chalk';
import { CounterweightPuzzle } from './counterweight';
import { SluicePuzzle } from './sluice';

/**
 * The four puzzle concepts, as required by the brief's "at least three
 * different puzzle concepts" - and deliberately four different *kinds* of
 * thinking rather than four variations on one:
 *
 *   Bridge        traversal under a mechanical constraint
 *   Chalk         reading symbols left by someone else, under threat
 *   Counterweight physical manipulation where the tool and the hazard compete
 *   Sluice        narrative deduction - the answer is in the documents
 *
 * None of them is a key-and-door, and none of them can soft-lock.
 */
export class PuzzleRegistry {
  readonly bridge = new BridgePuzzle();
  readonly chalk = new ChalkPuzzle();
  readonly counterweight = new CounterweightPuzzle();
  readonly sluice = new SluicePuzzle();

  readonly all: readonly Puzzle<never>[] = [
    this.bridge as unknown as Puzzle<never>,
    this.chalk as unknown as Puzzle<never>,
    this.counterweight as unknown as Puzzle<never>,
    this.sluice as unknown as Puzzle<never>,
  ];

  /** Restores every puzzle from the save. */
  loadAll(ctx: PuzzleContext): void {
    for (const p of this.all) p.load(ctx);
  }

  resetAll(ctx: PuzzleContext): void {
    for (const p of this.all) p.reset(ctx);
  }

  byId(id: string): Puzzle<never> | null {
    return this.all.find((p) => p.id === id) ?? null;
  }

  /** Used by the automated progression audit. */
  auditSoftlocks(ctx: PuzzleContext): string[] {
    return this.all
      .map((p) => {
        const risk = p.softlockRisk(ctx);
        return risk ? `${p.id}: ${risk}` : null;
      })
      .filter((r): r is string => r !== null);
  }
}

export { type Puzzle, type PuzzleContext } from './types';
export { BridgePuzzle } from './bridge';
export { ChalkPuzzle, WARD_FLOOR, type ChalkGlyph } from './chalk';
export { CounterweightPuzzle } from './counterweight';
export { SluicePuzzle, DIAL_TIMES, detentLabel } from './sluice';
