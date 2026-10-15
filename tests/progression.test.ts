import { describe, expect, it } from 'vitest';
import { ALWAYS_PRESENT, CollisionWorld, settleOnGround } from '@/physics/collision';
import { makeBody } from '@/physics/types';
import { PROPS } from '@/rendering/props';
import { PALETTES } from '@/rendering/palette';
import { CLUES, ITEMS } from '@/narrative/clues';
import { TEXT } from '@/narrative/text';
import { CINEMATICS } from '@/gameplay/cinematics';
import { SCENES, SCENE_ORDER, chapterOf } from '@/scenes';
import { rectsOverlap } from '@/core/math';
import type { SceneDef, SceneId } from '@/world/types';

const allScenes = SCENE_ORDER.map((id) => SCENES[id]);

/**
 * The progression audit.
 *
 * PART 13 of the brief asks for a full logical progression audit: for each
 * chapter, verify that a player can enter, find the required clues, complete
 * the necessary puzzles and reach the next scene. These tests do that against
 * the real scene data, with no renderer - so a level-design mistake that would
 * strand a player fails the build rather than the playthrough.
 */

describe('scene integrity', () => {
  it('has six chapters in order', () => {
    expect(SCENE_ORDER).toHaveLength(6);
    for (const [i, id] of SCENE_ORDER.entries()) {
      expect(chapterOf(id)).toBe(i + 1);
      expect(SCENES[id].id).toBe(id);
    }
  });

  it.each(allScenes.map((s) => [s.id, s] as [SceneId, SceneDef]))(
    '%s is structurally sound',
    (_id, scene) => {
      expect(scene.title.length).toBeGreaterThan(0);
      expect(scene.subtitle.length).toBeGreaterThan(0);
      expect(scene.spawns.default).toBeDefined();
      expect(scene.bounds.w).toBeGreaterThan(400);
      expect(scene.bounds.h).toBeGreaterThan(200);
      expect(scene.colliders.length).toBeGreaterThan(0);
      expect(scene.props.length).toBeGreaterThan(10);
      expect(Object.values(PALETTES)).toContain(scene.palette);
    },
  );

  it('every placed prop exists in the registry', () => {
    const missing = new Set<string>();
    for (const scene of allScenes) {
      for (const p of scene.props) if (!(p.prop in PROPS)) missing.add(`${scene.id}:${p.prop}`);
    }
    expect([...missing]).toEqual([]);
  });

  it('every prop depth is a valid parallax band', () => {
    for (const scene of allScenes) {
      for (const p of scene.props) {
        expect(p.depth).toBeGreaterThanOrEqual(0);
        expect(p.depth).toBeLessThanOrEqual(6);
      }
    }
  });

  it('every spawn point is inside the scene bounds and has ground under it', () => {
    for (const scene of allScenes) {
      const world = new CollisionWorld(scene.colliders);
      for (const [name, spawn] of Object.entries(scene.spawns)) {
        const b = scene.bounds;
        expect(
          spawn.x >= b.x && spawn.x <= b.x + b.w,
          `${scene.id}/${name} x out of bounds`,
        ).toBe(true);
        expect(
          spawn.y >= b.y && spawn.y <= b.y + b.h,
          `${scene.id}/${name} y out of bounds`,
        ).toBe(true);

        // Only present-layer geometry counts: a spawn must never depend on
        // the player having the lantern lit.
        const body = makeBody(spawn.x, spawn.y);
        const landed = settleOnGround(body, world, ALWAYS_PRESENT, 700);
        expect(landed, `${scene.id}/${name} has no present-day floor beneath it`).toBe(true);
      }
    }
  });

  it('no spawn point starts the player inside a solid wall', () => {
    for (const scene of allScenes) {
      const world = new CollisionWorld(scene.colliders);
      for (const [name, spawn] of Object.entries(scene.spawns)) {
        const rect = { x: spawn.x - 9, y: spawn.y - 56, w: 18, h: 54 };
        expect(
          world.blocked(rect, ALWAYS_PRESENT),
          `${scene.id}/${name} spawns inside geometry`,
        ).toBe(false);
      }
    }
  });

  it('every Drowned patrol span is sane', () => {
    for (const scene of allScenes) {
      for (const d of scene.drowned) {
        expect(d.homeMax, `${scene.id}/${d.id}`).toBeGreaterThanOrEqual(d.homeMin);
        expect(d.x).toBeGreaterThanOrEqual(d.homeMin - 1);
        expect(d.x).toBeLessThanOrEqual(d.homeMax + 1);
      }
    }
  });

  it('ids are unique within a scene', () => {
    for (const scene of allScenes) {
      const ids = [
        ...scene.interactables.map((i) => i.id),
        ...scene.triggers.map((t) => t.id),
        ...scene.drowned.map((d) => d.id),
      ];
      expect(new Set(ids).size, `${scene.id} has duplicate ids`).toBe(ids.length);
    }
  });
});

describe('scene graph connectivity', () => {
  /** Every exit, from doors and from trigger volumes. */
  const exitsOf = (scene: SceneDef): Array<{ to: SceneId; spawn: string; from: string }> => {
    const out: Array<{ to: SceneId; spawn: string; from: string }> = [];
    for (const i of scene.interactables) {
      if (i.kind === 'door' && i.exitTo) {
        out.push({ to: i.exitTo, spawn: i.exitSpawn ?? 'default', from: i.id });
      }
    }
    for (const t of scene.triggers) {
      if (t.kind === 'exit' && t.exitTo) {
        out.push({ to: t.exitTo, spawn: t.exitSpawn ?? 'default', from: t.id });
      }
    }
    return out;
  };

  it('every exit names a real scene and a real spawn point', () => {
    for (const scene of allScenes) {
      for (const exit of exitsOf(scene)) {
        const target = SCENES[exit.to];
        expect(target, `${scene.id}:${exit.from} -> unknown scene ${exit.to}`).toBeDefined();
        expect(
          target.spawns[exit.spawn],
          `${scene.id}:${exit.from} -> ${exit.to}/${exit.spawn} does not exist`,
        ).toBeDefined();
      }
    }
  });

  it('each chapter has an exit to the next one', () => {
    for (let i = 0; i < SCENE_ORDER.length - 1; i++) {
      const scene = SCENES[SCENE_ORDER[i]];
      const next = SCENE_ORDER[i + 1];
      const found = exitsOf(scene).some((e) => e.to === next);
      expect(found, `${scene.id} has no exit to ${next}`).toBe(true);
    }
  });

  it('the final chapter ends rather than exiting', () => {
    const final = SCENES[SCENE_ORDER[SCENE_ORDER.length - 1]];
    expect(exitsOf(final)).toHaveLength(0);
    const endings = final.triggers.filter((t) => t.kind === 'cinematic');
    expect(endings.length).toBeGreaterThan(0);
  });

  it('every scene is reachable from the first', () => {
    const seen = new Set<SceneId>(['shore']);
    const queue: SceneId[] = ['shore'];
    while (queue.length > 0) {
      const id = queue.shift()!;
      for (const exit of exitsOf(SCENES[id])) {
        if (!seen.has(exit.to)) {
          seen.add(exit.to);
          queue.push(exit.to);
        }
      }
    }
    expect([...seen].sort()).toEqual([...SCENE_ORDER].sort());
  });
});

describe('gating and flag reachability', () => {
  /** Every flag any content can set. */
  const grantableFlags = (): Set<string> => {
    const flags = new Set<string>();
    for (const scene of allScenes) {
      for (const i of scene.interactables) if (i.setsFlag) flags.add(i.setsFlag);
      for (const t of scene.triggers) {
        if (t.setsFlag) flags.add(t.setsFlag);
        if (t.kind === 'checkpoint' || t.kind === 'camera') continue;
        if (t.once !== false) flags.add(`trig:${t.id}`);
      }
    }
    // Set by the puzzles.
    for (const f of ['bridge-crossed', 'ward-crossed', 'tunnel-beam-raised', 'gate-log-open']) {
      flags.add(f);
    }
    // Set by cinematics and by the director.
    for (const c of Object.values(CINEMATICS)) {
      flags.add(`cine:${c.id}`);
      for (const s of c.steps) if (s.flag) flags.add(s.flag);
    }
    flags.add('completed');
    for (const scene of allScenes) {
      for (const i of scene.interactables) if (i.once) flags.add(`used:${i.id}`);
    }
    return flags;
  };

  it('every required flag can actually be granted somewhere', () => {
    const grantable = grantableFlags();
    const unreachable: string[] = [];
    for (const scene of allScenes) {
      const check = (flag: string | undefined, where: string): void => {
        if (flag && !grantable.has(flag)) unreachable.push(`${where} requires "${flag}"`);
      };
      for (const i of scene.interactables) {
        check(i.requiresFlag, `${scene.id}:${i.id}`);
        check(i.hiddenByFlag, `${scene.id}:${i.id}`);
      }
      for (const t of scene.triggers) {
        check(t.requiresFlag, `${scene.id}:${t.id}`);
        check(t.hiddenByFlag, `${scene.id}:${t.id}`);
      }
      for (const d of scene.drowned) check(d.requiresFlag, `${scene.id}:${d.id}`);
      for (const c of scene.colliders) {
        check(c.requiresFlag, `${scene.id}:collider`);
        check(c.blockedByFlag, `${scene.id}:collider`);
      }
      for (const l of scene.lamps) check(l.requiresFlag, `${scene.id}:${l.id ?? 'lamp'}`);
    }
    expect(unreachable).toEqual([]);
  });

  it('every required item can be picked up somewhere', () => {
    const granted = new Set<string>();
    for (const scene of allScenes) {
      for (const i of scene.interactables) if (i.itemId) granted.add(i.itemId);
    }
    const required: string[] = [];
    for (const scene of allScenes) {
      for (const i of scene.interactables) {
        if (i.requiresItem && !granted.has(i.requiresItem)) {
          required.push(`${scene.id}:${i.id} requires ${i.requiresItem}`);
        }
      }
    }
    expect(required).toEqual([]);
  });

  it('every clue a scene grants is defined in the journal', () => {
    const known = new Set(CLUES.map((c) => c.id));
    const unknown: string[] = [];
    for (const scene of allScenes) {
      for (const i of scene.interactables) {
        if (i.clueId && !known.has(i.clueId)) unknown.push(`${scene.id}:${i.id} -> ${i.clueId}`);
      }
    }
    expect(unknown).toEqual([]);
  });

  it('every item a scene grants is defined', () => {
    const known = new Set(ITEMS.map((i) => i.id));
    for (const scene of allScenes) {
      for (const i of scene.interactables) {
        if (i.itemId) expect(known.has(i.itemId), `${i.itemId} undefined`).toBe(true);
      }
    }
  });

  it('every referenced narrative text exists', () => {
    const missing: string[] = [];
    for (const scene of allScenes) {
      for (const i of scene.interactables) {
        for (const id of [i.textId, i.lockedTextId]) {
          if (id && !(id in TEXT)) missing.push(`${scene.id}:${i.id} -> ${id}`);
        }
      }
      for (const t of scene.triggers) {
        if (t.textId && !(t.textId in TEXT)) missing.push(`${scene.id}:${t.id} -> ${t.textId}`);
      }
    }
    for (const c of Object.values(CINEMATICS)) {
      for (const s of c.steps) {
        if (s.textId && !(s.textId in TEXT)) missing.push(`cinematic ${c.id} -> ${s.textId}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('every referenced cinematic exists', () => {
    const missing: string[] = [];
    for (const scene of allScenes) {
      if (scene.introCinematic && !(scene.introCinematic in CINEMATICS)) {
        missing.push(`${scene.id} intro -> ${scene.introCinematic}`);
      }
      for (const t of scene.triggers) {
        if (t.cinematicId && !(t.cinematicId in CINEMATICS)) {
          missing.push(`${scene.id}:${t.id} -> ${t.cinematicId}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });
});

describe('the critical path', () => {
  /**
   * Walks the intended playthrough and asserts each gate opens in turn.
   *
   * This is the test that would have caught the classic level-design failure:
   * a door gated on a flag that is only granted on the far side of that door.
   */
  it('completes chapter by chapter with no unopenable gate', () => {
    const held = new Set<string>();
    const items = new Set<string>();

    const grant = (...flags: string[]): void => {
      for (const f of flags) held.add(f);
    };

    // Chapter I: find the lantern, leave east.
    const shore = SCENES.shore;
    const lanternPickup = shore.interactables.find((i) => i.itemId === 'item-lantern');
    expect(lanternPickup).toBeDefined();
    expect(lanternPickup?.requiresFlag).toBeUndefined();
    expect(lanternPickup?.requiresItem).toBeUndefined();
    items.add('item-lantern');
    grant('has-lantern');

    const shoreExit = shore.triggers.find((t) => t.kind === 'exit' && t.exitTo === 'highstreet');
    expect(shoreExit).toBeDefined();
    expect(!shoreExit?.requiresFlag || held.has(shoreExit.requiresFlag)).toBe(true);

    // Chapter II: the notice, the rule, and the schoolhouse door.
    const street = SCENES.highstreet;
    const notice = street.interactables.find((i) => i.id === 'street-notice');
    expect(notice?.requiresFlag).toBeUndefined();
    grant('read-notice', 'seen-drowned', 'knows-rule', 'bridge-crossed');

    const wardDoor = street.interactables.find((i) => i.kind === 'door' && i.exitTo === 'ward');
    expect(wardDoor).toBeDefined();
    expect(!wardDoor?.requiresFlag || held.has(wardDoor.requiresFlag)).toBe(true);
    expect(!wardDoor?.requiresItem || items.has(wardDoor.requiresItem)).toBe(true);

    // Chapter III: the ward must be crossable to reach the stair.
    const ward = SCENES.ward;
    const stairBlock = ward.colliders.find((c) => c.blockedByFlag === 'ward-crossed');
    expect(stairBlock, 'the ward stair should be gated on crossing the ward').toBeDefined();
    grant('ward-crossed', 'read-register', 'found-coat');
    const tunnelExit = ward.triggers.find((t) => t.kind === 'exit' && t.exitTo === 'tunnels');
    expect(tunnelExit).toBeDefined();
    expect(!tunnelExit?.requiresFlag || held.has(tunnelExit.requiresFlag)).toBe(true);

    // Chapter IV: the crank must be obtainable before the winch needs it.
    const tunnels = SCENES.tunnels;
    const crank = tunnels.interactables.find((i) => i.itemId === 'item-crank');
    expect(crank).toBeDefined();
    expect(crank?.requiresItem).toBeUndefined();
    const winch = tunnels.interactables.find((i) => i.puzzleId === 'puzzle-counterweight');
    expect(winch?.requiresItem).toBe('item-crank');
    // The crank must be reachable without passing the beam it unblocks.
    const beam = tunnels.colliders.find((c) => c.id === 'tunnel-beam');
    expect(beam).toBeDefined();
    expect(crank!.zone.x).toBeLessThan(beam!.x);
    expect(winch!.zone.x).toBeLessThan(beam!.x);
    items.add('item-crank');
    grant('read-ledger', 'knows-ec', 'tunnel-beam-raised');

    const gatehouseExit = tunnels.triggers.find((t) => t.kind === 'exit' && t.exitTo === 'gatehouse');
    expect(gatehouseExit).toBeDefined();

    // Chapter V: clocks -> dials -> log -> the door out.
    const gatehouse = SCENES.gatehouse;
    const clocks = gatehouse.interactables.find((i) => i.id === 'gate-clocks');
    expect(clocks?.requiresFlag).toBeUndefined();
    expect(clocks?.clueId).toBe('clue-clocks');
    grant('read-clocks');

    const dials = gatehouse.interactables.filter((i) => i.puzzleId === 'puzzle-sluice');
    expect(dials).toHaveLength(3);
    for (const dial of dials) {
      expect(!dial.requiresFlag || held.has(dial.requiresFlag), `dial ${dial.id} is gated`).toBe(true);
    }
    grant('gate-log-open');

    const log = gatehouse.interactables.find((i) => i.itemId === 'item-log');
    expect(log?.requiresFlag).toBe('gate-log-open');
    expect(held.has(log!.requiresFlag!)).toBe(true);
    items.add('item-log');
    grant('has-log');

    const outDoor = gatehouse.interactables.find((i) => i.kind === 'door' && i.exitTo === 'gate');
    expect(outDoor?.requiresFlag).toBe('has-log');
    expect(held.has(outDoor!.requiresFlag!)).toBe(true);
    const gateBlock = gatehouse.colliders.find((c) => c.blockedByFlag === 'has-log');
    expect(gateBlock).toBeDefined();

    // Chapter VI: the ending is available with what she is carrying.
    const gate = SCENES.gate;
    const show = gate.interactables.find((i) => i.puzzleId === 'ending-shown');
    expect(show).toBeDefined();
    expect(show?.requiresItem).toBe('item-log');
    expect(items.has(show!.requiresItem!)).toBe(true);
    const ending = gate.triggers.find((t) => t.cinematicId === 'ending');
    expect(ending).toBeDefined();
  });

  it('the cold ending needs nothing, so the finale cannot strand the player', () => {
    // Walking east ends the game whether or not she shows him the log. If the
    // only exit required the warm ending, a player who doused the lamp would
    // be stuck in a flooding valley forever.
    const gate = SCENES.gate;
    const ending = gate.triggers.find((t) => t.cinematicId === 'ending');
    expect(ending?.requiresFlag).toBeUndefined();
    expect(ending?.requiresLantern).toBeUndefined();
  });

  it('both endings are authored', () => {
    expect(CINEMATICS['ending-shown']).toBeDefined();
    expect(CINEMATICS['ending-withheld']).toBeDefined();
    expect(CINEMATICS['ending-shown'].steps.some((s) => s.ending === 'shown')).toBe(true);
    expect(CINEMATICS['ending-withheld'].steps.some((s) => s.ending === 'withheld')).toBe(true);
  });

  it('the required content from the brief is all present', () => {
    // Title, opening, protagonist, multiple connected environments, a mystery,
    // discoveries, three puzzle concepts, a horror sequence, a revelation,
    // a deliberate ending, saves and credits.
    expect(allScenes.length).toBeGreaterThanOrEqual(4);
    expect(CLUES.length).toBeGreaterThanOrEqual(8);
    const puzzleIds = new Set<string>();
    for (const scene of allScenes) {
      for (const i of scene.interactables) if (i.puzzleId) puzzleIds.add(i.puzzleId);
    }
    // Three interactable-driven puzzles plus the bridge, which is positional.
    expect(puzzleIds.size).toBeGreaterThanOrEqual(3);
    expect(SCENES.ward.drowned.length).toBeGreaterThan(0);
    expect(TEXT['gate-revelation']).toBeDefined();
  });
});

describe('level geometry sanity', () => {
  it('no scene has overlapping contradictory floors at the same height', () => {
    // Two solid floors at the same surface overlapping is harmless, but a
    // solid and a one-way at the same height fight each other.
    for (const scene of allScenes) {
      const solids = scene.colliders.filter((c) => c.kind === 'solid' && c.layer === 'present');
      const oneways = scene.colliders.filter((c) => c.kind === 'oneway' && c.layer === 'present');
      for (const s of solids) {
        for (const o of oneways) {
          if (Math.abs(s.y - o.y) < 2 && rectsOverlap(s, o)) {
            throw new Error(`${scene.id}: solid and oneway collide at y=${s.y}`);
          }
        }
      }
    }
  });

  it('every Before-layer collider has a present-day counterpart or a fall-back floor', () => {
    // A Before-only floor over a bottomless pit is a death trap if the lamp
    // dies. Each scene must have present-day ground somewhere below every
    // Before floor, OR be a deliberate drop with a floor further down.
    for (const scene of allScenes) {
      const beforeFloors = scene.colliders.filter(
        (c) => c.layer === 'before' && (c.kind === 'solid' || c.kind === 'oneway'),
      );
      const presentFloors = scene.colliders.filter(
        (c) => c.layer === 'present' && (c.kind === 'solid' || c.kind === 'oneway'),
      );
      for (const bf of beforeFloors) {
        const sampleX = bf.x + bf.w * 0.5;
        const below = presentFloors.some(
          (pf) => sampleX >= pf.x && sampleX <= pf.x + pf.w && pf.y > bf.y - 1,
        );
        expect(
          below,
          `${scene.id}: Before floor at x=${Math.round(sampleX)} y=${bf.y} has nothing beneath it`,
        ).toBe(true);
      }
    }
  });
});
