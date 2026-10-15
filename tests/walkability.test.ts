import { describe, expect, it } from 'vitest';
import { ALWAYS_PRESENT, CollisionWorld, depenetrate, moveBody, settleOnGround } from '@/physics/collision';
import { makeBody } from '@/physics/types';
import { SCENES, SCENE_ORDER } from '@/scenes';
import type { SceneDef } from '@/world/types';

const allScenes = SCENE_ORDER.map((id) => SCENES[id]);

/**
 * Walkability audit.
 *
 * The bug this exists to prevent: a boundary wall that overlaps the floor it
 * is supposed to bound. A player who walks into that overlap is inside a solid,
 * and an axis-separated solver resolves by direction of travel, so it can eject
 * them out of the world into a fall with no floor underneath - an
 * unrecoverable soft-lock that no amount of narrative testing would find.
 *
 * So: sample the whole width of every scene, and assert that anywhere the
 * player can stand, they are not inside geometry.
 */

const standingRect = (x: number, y: number) => ({ x: x - 9, y: y - 56, w: 18, h: 54 });

interface Sample {
  x: number;
  y: number;
}

/** Every x across the scene where present-day ground exists, with its height. */
const groundProfile = (scene: SceneDef, step = 16): Sample[] => {
  const world = new CollisionWorld(scene.colliders);
  const out: Sample[] = [];
  for (let x = scene.bounds.x; x <= scene.bounds.x + scene.bounds.w; x += step) {
    const body = makeBody(x, scene.bounds.y + 10);
    if (settleOnGround(body, world, ALWAYS_PRESENT, scene.bounds.h + 200)) {
      out.push({ x, y: body.y });
    }
  }
  return out;
};

describe('walkable ground', () => {
  it.each(allScenes.map((s) => [s.id, s] as const))(
    '%s: nowhere the player can stand is inside geometry',
    (_id, scene) => {
      const world = new CollisionWorld(scene.colliders);
      const bad: string[] = [];
      for (const { x, y } of groundProfile(scene)) {
        if (world.blocked(standingRect(x, y), ALWAYS_PRESENT)) {
          bad.push(`x=${Math.round(x)} y=${Math.round(y)}`);
        }
      }
      expect(bad.slice(0, 8)).toEqual([]);
    },
  );

  it.each(allScenes.map((s) => [s.id, s] as const))(
    '%s has a continuous walkable span containing every spawn',
    (_id, scene) => {
      const profile = groundProfile(scene);
      expect(profile.length).toBeGreaterThan(10);
      for (const [name, spawn] of Object.entries(scene.spawns)) {
        const near = profile.some((p) => Math.abs(p.x - spawn.x) <= 40);
        expect(near, `${scene.id}/${name} has no ground profile near it`).toBe(true);
      }
    },
  );
});

describe('the player cannot leave the world', () => {
  /**
   * Walks the player from every spawn, in both directions, at running speed,
   * and asserts she is still inside the scene bounds at the end. This is a
   * blunt instrument and that is the point: it is the test that would have
   * caught the overlapping boundary walls.
   */
  it.each(allScenes.map((s) => [s.id, s] as const))(
    '%s: running into every boundary keeps her in the world',
    (_id, scene) => {
      const world = new CollisionWorld(scene.colliders);
      const escapes: string[] = [];

      for (const [name, spawn] of Object.entries(scene.spawns)) {
        for (const dir of [-1, 1]) {
          const body = makeBody(spawn.x, spawn.y);
          settleOnGround(body, world, ALWAYS_PRESENT, 400);
          // 12 seconds at running speed: more than enough to cross any scene.
          for (let i = 0; i < 720; i++) {
            body.vx = dir * 182;
            body.vy = Math.min(760, body.vy + 1180 / 60);
            moveBody(body, 1 / 60, world, ALWAYS_PRESENT);
          }
          const b = scene.bounds;
          const outside =
            body.x < b.x - 120 ||
            body.x > b.x + b.w + 120 ||
            body.y > b.y + b.h + 200;
          if (outside) {
            escapes.push(
              `${name} heading ${dir > 0 ? 'east' : 'west'} ended at ` +
                `${Math.round(body.x)},${Math.round(body.y)}`,
            );
          }
        }
      }
      expect(escapes).toEqual([]);
    },
  );
});

describe('traversability', () => {
  /**
   * Can the player actually get from a chapter's entrance to its exit?
   *
   * The "cannot leave the world" test proves she does not escape; this proves
   * she is not trapped, which is the opposite failure and the one that ends a
   * playthrough. Every gate is treated as open (the progression audit covers
   * gating separately), so a failure here is pure geometry: a step too tall,
   * a wall in the wrong place, a floor that does not reach.
   */
  const openQuery = { isBeforeLit: () => true, hasFlag: () => true };

  /** Runs toward a target x, climbing ladders when they help. Returns the furthest x reached. */
  const runTo = (scene: SceneDef, fromX: number, fromY: number, targetX: number): number => {
    const world = new CollisionWorld(scene.colliders);
    const body = makeBody(fromX, fromY, 9, 56);
    settleOnGround(body, world, openQuery, 500);
    const dir = Math.sign(targetX - fromX) || 1;
    let best = body.x;
    let stuckFor = 0;

    for (let i = 0; i < 2400; i++) {
      const before = body.x;
      // Mirror the locomotion rule: a low space forces - and holds - a crouch.
      body.height = body.inLowSpace ? 56 * 0.56 : 56;
      body.vx = dir * 182;
      // Climb if a ladder is available and we are not making progress.
      if (body.onLadder && stuckFor > 20) {
        body.vy = -72;
      } else {
        body.vy = Math.min(760, body.vy + 1180 / 60);
      }
      moveBody(body, 1 / 60, world, openQuery);

      if (dir > 0 ? body.x > best : body.x < best) {
        best = body.x;
        stuckFor = 0;
      } else if (Math.abs(body.x - before) < 0.2) {
        stuckFor++;
      }
      if (dir > 0 ? body.x >= targetX : body.x <= targetX) return body.x;
      // Give up only after a long stall with no ladder to try.
      if (stuckFor > 420) break;
    }
    return best;
  };

  /** The x of the scene's exit to the next chapter. */
  const exitX = (scene: SceneDef): number | null => {
    for (const t of scene.triggers) {
      if (t.kind === 'exit') return t.zone.x + t.zone.w / 2;
    }
    for (const i of scene.interactables) {
      if (i.kind === 'door' && i.exitTo) return i.zone.x + i.zone.w / 2;
    }
    return null;
  };

  it.each(allScenes.map((s) => [s.id, s] as const))(
    '%s: the entrance can reach the exit on foot',
    (_id, scene) => {
      const target = exitX(scene);
      if (target === null) {
        // The finale ends on a trigger rather than an exit.
        expect(scene.id).toBe('gate');
        return;
      }
      const entry = scene.spawns.west ?? scene.spawns.default;
      const reached = runTo(scene, entry.x, entry.y, target);
      expect(
        reached,
        `${scene.id}: stuck at x=${Math.round(reached)} trying to reach the exit at ${Math.round(target)}`,
      ).toBeGreaterThanOrEqual(target - 40);
    },
  );

  it('the finale can be walked from the catwalk to the valley side', () => {
    const scene = SCENES.gate;
    const ending = scene.triggers.find((t) => t.cinematicId === 'ending');
    expect(ending).toBeDefined();
    const target = ending!.zone.x + ending!.zone.w / 2;
    // She arrives on the catwalk and climbs down to the apron first.
    const reached = runTo(scene, scene.spawns.mouth.x, scene.spawns.mouth.y, target);
    expect(
      reached,
      `gate: stuck at x=${Math.round(reached)} trying to reach the ending at ${Math.round(target)}`,
    ).toBeGreaterThanOrEqual(target - 40);
  });

  it('every mid-scene checkpoint is reachable from the entrance', () => {
    const problems: string[] = [];
    for (const scene of allScenes) {
      const entry = scene.spawns.west ?? scene.spawns.default;
      for (const [name, spawn] of Object.entries(scene.spawns)) {
        if (spawn === entry) continue;
        // Only forward-of-entry spawns; some are behind by design.
        if (spawn.x <= entry.x) continue;
        const reached = runTo(scene, entry.x, entry.y, spawn.x);
        if (reached < spawn.x - 60) {
          problems.push(`${scene.id}/${name}: reached ${Math.round(reached)} of ${Math.round(spawn.x)}`);
        }
      }
    }
    expect(problems).toEqual([]);
  });
});

describe('de-penetration', () => {
  it('pushes a body out of a wall by the nearest face', () => {
    const world = new CollisionWorld([
      { kind: 'solid', layer: 'present', x: 0, y: -200, w: 100, h: 200 },
    ]);
    // Body centred 20px inside the left face: it should leave to the left.
    const body = makeBody(20, 0);
    expect(depenetrate(body, world, ALWAYS_PRESENT)).toBe(true);
    expect(body.x).toBeLessThan(0);
  });

  it('leaves a body that is not overlapping alone', () => {
    const world = new CollisionWorld([
      { kind: 'solid', layer: 'present', x: 0, y: -200, w: 100, h: 200 },
    ]);
    const body = makeBody(-200, 0);
    expect(depenetrate(body, world, ALWAYS_PRESENT)).toBe(false);
    expect(body.x).toBe(-200);
  });

  it('treats resting contact as contact, not penetration', () => {
    // A grounded body is seated a hair inside its floor on purpose. If
    // de-penetration fired on that, it would cancel her velocity every step
    // and she could never walk - which is exactly what it did once.
    const world = new CollisionWorld([
      { kind: 'solid', layer: 'present', x: -100, y: 0, w: 200, h: 400 },
    ]);
    const body = makeBody(0, 0.001);
    expect(depenetrate(body, world, ALWAYS_PRESENT)).toBe(false);
    expect(body.y).toBeCloseTo(0.001, 4);
  });

  it('lifts a body that is deeply sunk into a floor', () => {
    const world = new CollisionWorld([
      { kind: 'solid', layer: 'present', x: -100, y: 0, w: 200, h: 400 },
    ]);
    const body = makeBody(0, 30);
    expect(depenetrate(body, world, ALWAYS_PRESENT)).toBe(true);
    expect(body.y).toBeCloseTo(0, 1);
  });

  it('does not eject a body through a wall it is deeply inside', () => {
    // A thin wall overlapping a floor: the body must end up standing on the
    // floor, not teleported to the far side of the level.
    const world = new CollisionWorld([
      { kind: 'solid', layer: 'present', x: -400, y: 0, w: 800, h: 400 },
      { kind: 'solid', layer: 'present', x: -20, y: -300, w: 40, h: 300 },
    ]);
    const body = makeBody(0, 0);
    depenetrate(body, world, ALWAYS_PRESENT);
    expect(Math.abs(body.x)).toBeLessThan(200);
  });
});
