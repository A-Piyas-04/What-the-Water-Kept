import { beforeEach, describe, expect, it } from 'vitest';
import { GameState } from '@/gameplay/state';
import {
  BridgePuzzle,
  ChalkPuzzle,
  CounterweightPuzzle,
  PuzzleRegistry,
  SluicePuzzle,
  WARD_FLOOR,
  detentLabel,
} from '@/puzzles';
import type { PuzzleContext } from '@/puzzles/types';

const makeCtx = (): PuzzleContext & { solved: string[]; feedback: string[] } => {
  const solved: string[] = [];
  const feedback: string[] = [];
  return {
    state: new GameState(),
    onSolved: (id) => solved.push(id),
    onFeedback: (id, kind) => feedback.push(`${id}:${kind}`),
    solved,
    feedback,
  };
};

describe('sluice dials', () => {
  let ctx: ReturnType<typeof makeCtx>;
  let puzzle: SluicePuzzle;

  beforeEach(() => {
    ctx = makeCtx();
    puzzle = new SluicePuzzle();
    puzzle.load(ctx);
  });

  const turnTo = (dial: number, target: number): void => {
    while (puzzle.dialAt(dial) !== target) puzzle.input(ctx, { dial });
  };

  it('starts unsolved', () => {
    expect(puzzle.isSolved(ctx)).toBe(false);
    expect(puzzle.progress(ctx)).toBe(0);
  });

  it('advances one detent per input and wraps around', () => {
    expect(puzzle.dialAt(0)).toBe(0);
    for (let i = 0; i < 12; i++) puzzle.input(ctx, { dial: 0 });
    expect(puzzle.dialAt(0)).toBe(0);
  });

  it('solves on the ledger times and sets the flag', () => {
    turnTo(0, 8);
    turnTo(1, 9);
    turnTo(2, 11);
    expect(puzzle.isSolved(ctx)).toBe(true);
    expect(ctx.state.hasFlag('gate-log-open')).toBe(true);
    expect(ctx.solved).toContain('puzzle-sluice');
  });

  it('solves exactly once', () => {
    turnTo(0, 8);
    turnTo(1, 9);
    turnTo(2, 11);
    puzzle.input(ctx, { dial: 0 });
    expect(ctx.solved.filter((s) => s === 'puzzle-sluice')).toHaveLength(1);
  });

  it('does not solve on a near-miss', () => {
    turnTo(0, 8);
    turnTo(1, 9);
    turnTo(2, 10);
    expect(puzzle.isSolved(ctx)).toBe(false);
    expect(puzzle.progress(ctx)).toBeCloseTo(2 / 3, 5);
  });

  it('ignores out-of-range dials', () => {
    expect(puzzle.input(ctx, { dial: 7 })).toBe(false);
    expect(puzzle.input(ctx, { dial: -1 })).toBe(false);
  });

  it('round-trips through the save record', () => {
    turnTo(0, 5);
    const restored = new SluicePuzzle();
    restored.load(ctx);
    expect(restored.dialAt(0)).toBe(5);
  });

  it('labels detents as times within the flood hour', () => {
    expect(detentLabel(0)).toBe('21:00');
    expect(detentLabel(8)).toBe('21:40');
    expect(detentLabel(11)).toBe('21:55');
  });

  it('resets cleanly', () => {
    turnTo(0, 8);
    turnTo(1, 9);
    turnTo(2, 11);
    puzzle.reset(ctx);
    expect(puzzle.isSolved(ctx)).toBe(false);
    expect(puzzle.dialAt(0)).toBe(0);
  });
});

describe('footbridge', () => {
  let ctx: ReturnType<typeof makeCtx>;
  let puzzle: BridgePuzzle;

  beforeEach(() => {
    ctx = makeCtx();
    puzzle = new BridgePuzzle();
    puzzle.load(ctx);
  });

  it('records stepping onto the span', () => {
    puzzle.input(ctx, { onSpan: true, atFarSide: false, fell: false });
    expect(puzzle.progress(ctx)).toBe(0.5);
  });

  it('counts falls without failing the puzzle', () => {
    puzzle.input(ctx, { onSpan: true, atFarSide: false, fell: true });
    puzzle.input(ctx, { onSpan: true, atFarSide: false, fell: true });
    expect(puzzle.fallCount).toBe(2);
    expect(puzzle.isSolved(ctx)).toBe(false);
  });

  it('completes on reaching the far side, even after falling', () => {
    puzzle.input(ctx, { onSpan: true, atFarSide: false, fell: true });
    puzzle.input(ctx, { onSpan: true, atFarSide: true, fell: false });
    expect(puzzle.isSolved(ctx)).toBe(true);
    expect(ctx.state.hasFlag('bridge-crossed')).toBe(true);
  });
});

describe("the children's chalk", () => {
  let ctx: ReturnType<typeof makeCtx>;
  let puzzle: ChalkPuzzle;

  beforeEach(() => {
    ctx = makeCtx();
    puzzle = new ChalkPuzzle();
    puzzle.load(ctx);
  });

  it('wakes nothing when the lamp is off, on any section', () => {
    for (let i = 0; i < WARD_FLOOR.length; i++) {
      expect(ChalkPuzzle.wakes(i, false)).toBe(false);
    }
  });

  it('wakes on a lit cross and not on a lit hush', () => {
    const cross = WARD_FLOOR.indexOf('cross');
    const hush = WARD_FLOOR.indexOf('hush');
    expect(ChalkPuzzle.wakes(cross, true)).toBe(true);
    expect(ChalkPuzzle.wakes(hush, true)).toBe(false);
  });

  it('has both kinds of mark, so reading the floor matters', () => {
    expect(WARD_FLOOR).toContain('hush');
    expect(WARD_FLOOR).toContain('cross');
  });

  it('can be crossed entirely in the dark', () => {
    for (let i = 0; i < WARD_FLOOR.length; i++) puzzle.input(ctx, { section: i, lit: false });
    expect(puzzle.isSolved(ctx)).toBe(true);
    expect(puzzle.wakeCount).toBe(0);
  });

  it('counts wakes when the player lights the wrong boards', () => {
    for (let i = 0; i < WARD_FLOOR.length; i++) puzzle.input(ctx, { section: i, lit: true });
    expect(puzzle.wakeCount).toBe(WARD_FLOOR.filter((g) => g === 'cross').length);
    expect(puzzle.isSolved(ctx)).toBe(true);
  });

  it('tracks progress monotonically and ignores going back', () => {
    puzzle.input(ctx, { section: 3, lit: false });
    const p = puzzle.progress(ctx);
    puzzle.input(ctx, { section: 1, lit: false });
    expect(puzzle.progress(ctx)).toBe(p);
  });

  it('ignores sections outside the floor', () => {
    expect(puzzle.input(ctx, { section: 99, lit: true })).toBe(false);
    expect(puzzle.input(ctx, { section: -4, lit: true })).toBe(false);
  });
});

describe('counterweight cart', () => {
  let ctx: ReturnType<typeof makeCtx>;
  let puzzle: CounterweightPuzzle;

  beforeEach(() => {
    ctx = makeCtx();
    puzzle = new CounterweightPuzzle();
    puzzle.load(ctx);
  });

  it('refuses to crank when the rail is not lit', () => {
    expect(puzzle.input(ctx, { kind: 'crank', lit: false })).toBe(false);
    expect(puzzle.progress(ctx)).toBe(0);
    expect(ctx.feedback).toContain('puzzle-counterweight:reject');
  });

  it('advances while the rail is lit', () => {
    puzzle.input(ctx, { kind: 'crank', lit: true });
    expect(puzzle.progress(ctx)).toBeGreaterThan(0);
  });

  it('ratchets: progress never goes backwards between cranks', () => {
    puzzle.input(ctx, { kind: 'crank', lit: true });
    const after = puzzle.progress(ctx);
    // Lamp off for a long time; the cart must hold.
    for (let i = 0; i < 300; i++) puzzle.input(ctx, { kind: 'tick', dt: 1 / 60, lit: false });
    expect(puzzle.progress(ctx)).toBe(after);
  });

  it('solves after enough cranks and sets the flag', () => {
    for (let i = 0; i < 10; i++) puzzle.input(ctx, { kind: 'crank', lit: true });
    expect(puzzle.isSolved(ctx)).toBe(true);
    expect(ctx.state.hasFlag('tunnel-beam-raised')).toBe(true);
  });

  it('is reachable in a sane number of cranks', () => {
    let cranks = 0;
    while (!puzzle.isSolved(ctx) && cranks < 50) {
      puzzle.input(ctx, { kind: 'crank', lit: true });
      cranks++;
    }
    expect(cranks).toBeLessThanOrEqual(6);
  });

  it('settles its visual position toward the ratcheted one', () => {
    puzzle.input(ctx, { kind: 'crank', lit: true });
    const start = puzzle.visualPosition;
    for (let i = 0; i < 120; i++) puzzle.input(ctx, { kind: 'tick', dt: 1 / 60, lit: true });
    expect(puzzle.visualPosition).toBeGreaterThan(start);
    expect(puzzle.visualPosition).toBeLessThanOrEqual(1.0001);
  });

  it('restores as solved from a completed save', () => {
    ctx.state.setFlag('tunnel-beam-raised');
    const restored = new CounterweightPuzzle();
    restored.load(ctx);
    expect(restored.progress(ctx)).toBe(1);
    expect(restored.visualPosition).toBe(1);
  });
});

describe('puzzle registry', () => {
  it('exposes four distinct puzzle concepts', () => {
    const registry = new PuzzleRegistry();
    expect(registry.all).toHaveLength(4);
    expect(new Set(registry.all.map((p) => p.id)).size).toBe(4);
    expect(new Set(registry.all.map((p) => p.solvedFlag)).size).toBe(4);
  });

  it('no puzzle can soft-lock progression', () => {
    const ctx = makeCtx();
    const registry = new PuzzleRegistry();
    registry.loadAll(ctx);
    expect(registry.auditSoftlocks(ctx)).toEqual([]);
  });

  it('finds puzzles by id', () => {
    const registry = new PuzzleRegistry();
    expect(registry.byId('puzzle-sluice')).not.toBeNull();
    expect(registry.byId('nope')).toBeNull();
  });

  it('resets every puzzle', () => {
    const ctx = makeCtx();
    const registry = new PuzzleRegistry();
    registry.loadAll(ctx);
    for (const flag of registry.all.map((p) => p.solvedFlag)) ctx.state.setFlag(flag);
    registry.resetAll(ctx);
    for (const p of registry.all) expect(p.isSolved(ctx)).toBe(false);
  });
});
