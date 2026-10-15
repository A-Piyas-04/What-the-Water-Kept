import { describe, expect, it } from 'vitest';
import { ALWAYS_PRESENT, CollisionWorld, moveBody, settleOnGround } from '@/physics/collision';
import { type Collider, makeBody } from '@/physics/types';
import { beforeDeck, floor, wall } from '@/world/build';

const litQuery = (lit: boolean, flags: string[] = []) => ({
  isBeforeLit: () => lit,
  hasFlag: (f: string) => flags.includes(f),
});

describe('collision solver', () => {
  it('lands a falling body on a floor', () => {
    const world = new CollisionWorld([floor(-100, 100, 0)]);
    const body = makeBody(0, -200);
    body.vy = 400;
    for (let i = 0; i < 60; i++) moveBody(body, 1 / 60, world, ALWAYS_PRESENT);
    expect(body.onGround).toBe(true);
    expect(body.y).toBeCloseTo(0, 1);
    expect(body.vy).toBe(0);
  });

  it('stops horizontal movement at a wall', () => {
    const world = new CollisionWorld([floor(-200, 200, 0), wall(50, 0, 20, 100)]);
    const body = makeBody(0, 0);
    // Velocity is re-applied every step, as holding the stick would.
    let blockedAtLeastOnce = false;
    for (let i = 0; i < 30; i++) {
      body.vx = 300;
      moveBody(body, 1 / 60, world, ALWAYS_PRESENT);
      if (body.blockedX) blockedAtLeastOnce = true;
    }
    expect(blockedAtLeastOnce).toBe(true);
    expect(body.x).toBeLessThan(50);
    expect(body.vx).toBe(0);
  });

  it('does not tunnel through a thin wall at speed', () => {
    const world = new CollisionWorld([floor(-400, 400, 0), wall(100, 0, 8, 120)]);
    const body = makeBody(0, 0);
    body.vx = 2000;
    for (let i = 0; i < 20; i++) moveBody(body, 1 / 60, world, ALWAYS_PRESENT);
    expect(body.x).toBeLessThan(100);
  });

  it('reports a landing only on the frame it happens', () => {
    const world = new CollisionWorld([floor(-100, 100, 0)]);
    const body = makeBody(0, -30);
    body.vy = 500;
    let landings = 0;
    for (let i = 0; i < 40; i++) {
      if (moveBody(body, 1 / 60, world, ALWAYS_PRESENT).landed) landings++;
      body.vy += 1000 / 60;
    }
    expect(landings).toBe(1);
  });
});

describe('one-way colliders', () => {
  it('catches a body falling onto it', () => {
    const world = new CollisionWorld([{ kind: 'oneway', layer: 'present', x: -50, y: 0, w: 100, h: 10 }]);
    const body = makeBody(0, -60);
    body.vy = 300;
    for (let i = 0; i < 30; i++) moveBody(body, 1 / 60, world, ALWAYS_PRESENT);
    expect(body.onGround).toBe(true);
    expect(body.y).toBeCloseTo(0, 1);
  });

  it('lets a body rise through it', () => {
    const world = new CollisionWorld([{ kind: 'oneway', layer: 'present', x: -50, y: 0, w: 100, h: 10 }]);
    const body = makeBody(0, 40);
    body.vy = -300;
    for (let i = 0; i < 10; i++) moveBody(body, 1 / 60, world, ALWAYS_PRESENT);
    expect(body.y).toBeLessThan(0);
  });
});

describe('the lantern as physics', () => {
  const deck: Collider = beforeDeck(0, 400, 0);
  const world = new CollisionWorld([deck]);

  it('is not solid in the dark', () => {
    const body = makeBody(100, -60);
    body.vy = 400;
    for (let i = 0; i < 40; i++) moveBody(body, 1 / 60, world, litQuery(false));
    expect(body.onGround).toBe(false);
    expect(body.y).toBeGreaterThan(100);
  });

  it('is solid while lit', () => {
    const body = makeBody(100, -60);
    body.vy = 400;
    for (let i = 0; i < 40; i++) moveBody(body, 1 / 60, world, litQuery(true));
    expect(body.onGround).toBe(true);
    expect(body.y).toBeCloseTo(0, 1);
  });

  it('drops the body the moment the beam leaves it', () => {
    const body = makeBody(100, -60);
    body.vy = 400;
    for (let i = 0; i < 40; i++) moveBody(body, 1 / 60, world, litQuery(true));
    expect(body.onGround).toBe(true);
    // Lamp out.
    for (let i = 0; i < 20; i++) {
      body.vy += 1180 / 60;
      moveBody(body, 1 / 60, world, litQuery(false));
    }
    expect(body.onGround).toBe(false);
    expect(body.y).toBeGreaterThan(5);
  });
});

describe('flag-gated colliders', () => {
  const gate = wall(0, 0, 20, 100, { blockedByFlag: 'opened' });
  const world = new CollisionWorld([floor(-200, 200, 0), gate]);

  it('blocks while the flag is unset', () => {
    const body = makeBody(-60, 0);
    body.vx = 300;
    for (let i = 0; i < 40; i++) moveBody(body, 1 / 60, world, litQuery(false));
    expect(body.x).toBeLessThan(0);
  });

  it('opens once the flag is set', () => {
    const body = makeBody(-60, 0);
    body.vx = 300;
    for (let i = 0; i < 40; i++) moveBody(body, 1 / 60, world, litQuery(false, ['opened']));
    expect(body.x).toBeGreaterThan(20);
  });

  it('requiresFlag colliders are absent until granted', () => {
    const w = new CollisionWorld([floor(-200, 0, 0), floor(0, 200, 0, { requiresFlag: 'bridged' })]);
    const falling = makeBody(100, -40);
    falling.vy = 400;
    for (let i = 0; i < 40; i++) moveBody(falling, 1 / 60, w, litQuery(false));
    expect(falling.onGround).toBe(false);

    const supported = makeBody(100, -40);
    supported.vy = 400;
    for (let i = 0; i < 40; i++) moveBody(supported, 1 / 60, w, litQuery(false, ['bridged']));
    expect(supported.onGround).toBe(true);
  });
});

describe('volume queries', () => {
  it('detects ladders, low spaces and hazards', () => {
    const world = new CollisionWorld([
      floor(-200, 200, 0),
      { kind: 'ladder', layer: 'present', x: -10, y: -100, w: 20, h: 100 },
      { kind: 'lowspace', layer: 'present', x: 40, y: -40, w: 60, h: 40 },
      { kind: 'hazard', layer: 'present', x: 150, y: -20, w: 40, h: 60 },
    ]);
    const onLadder = makeBody(0, 0);
    moveBody(onLadder, 1 / 60, world, ALWAYS_PRESENT);
    expect(onLadder.onLadder).toBe(true);

    const crouching = makeBody(70, 0);
    moveBody(crouching, 1 / 60, world, ALWAYS_PRESENT);
    expect(crouching.inLowSpace).toBe(true);

    const drowning = makeBody(170, 0);
    moveBody(drowning, 1 / 60, world, ALWAYS_PRESENT);
    expect(drowning.inHazard).toBe(true);
  });
});

describe('settleOnGround', () => {
  it('drops a restored body onto the nearest floor', () => {
    const world = new CollisionWorld([floor(-100, 100, 40)]);
    const body = makeBody(0, -100);
    expect(settleOnGround(body, world, ALWAYS_PRESENT)).toBe(true);
    expect(body.y).toBeCloseTo(40, 0);
  });

  it('reports failure when there is nothing below', () => {
    const world = new CollisionWorld([floor(-100, 100, 0)]);
    const body = makeBody(500, 0);
    expect(settleOnGround(body, world, ALWAYS_PRESENT, 200)).toBe(false);
  });
});
