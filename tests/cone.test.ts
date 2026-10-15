import { describe, expect, it } from 'vitest';
import { type Cone, conePoint, coneIntensity, coneRect, coneRectIntensity } from '@/gameplay/cone';

const beam = (overrides: Partial<Cone> = {}): Cone => ({
  x: 0,
  y: 0,
  angle: 0,
  spread: 0.5,
  length: 200,
  ...overrides,
});

describe('lantern cone', () => {
  it('contains a point straight ahead', () => {
    expect(conePoint(beam(), 100, 0)).toBe(true);
  });

  it('excludes a point behind the apex', () => {
    expect(conePoint(beam(), -100, 0)).toBe(false);
  });

  it('excludes a point beyond its reach', () => {
    expect(conePoint(beam(), 260, 0)).toBe(false);
  });

  it('excludes a point outside the spread', () => {
    // 45 degrees off-axis, with a 0.5 rad (~28.6 deg) half-angle.
    expect(conePoint(beam(), 100, 100)).toBe(false);
  });

  it('includes a point just inside the spread', () => {
    const y = Math.tan(0.4) * 100;
    expect(conePoint(beam(), 100, y)).toBe(true);
  });

  it('lights the ground immediately underfoot regardless of angle', () => {
    // The near-field pool: standing on a Before floor lights it even when the
    // beam is aimed away, which is what stops the player falling through the
    // tile they are standing on.
    expect(conePoint(beam({ angle: Math.PI }), 0, 10)).toBe(true);
  });

  it('respects a rotated axis', () => {
    const up = beam({ angle: -Math.PI / 2 });
    expect(conePoint(up, 0, -100)).toBe(true);
    expect(conePoint(up, 0, 100)).toBe(false);
  });

  it('falls off with distance and angle', () => {
    const near = coneIntensity(beam(), 40, 0);
    const far = coneIntensity(beam(), 180, 0);
    const offAxis = coneIntensity(beam(), 40, 18);
    expect(near).toBeGreaterThan(far);
    expect(near).toBeGreaterThan(offAxis);
    expect(coneIntensity(beam(), 400, 0)).toBe(0);
  });

  it('is zero intensity outside the cone', () => {
    expect(coneIntensity(beam(), 100, 200)).toBe(0);
  });
});

describe('cone against rectangles', () => {
  it('hits a rect in front of it', () => {
    expect(coneRect(beam(), { x: 80, y: -10, w: 40, h: 20 })).toBe(true);
  });

  it('misses a rect behind it', () => {
    expect(coneRect(beam(), { x: -160, y: -10, w: 40, h: 20 })).toBe(false);
  });

  it('misses a rect out of reach', () => {
    expect(coneRect(beam(), { x: 400, y: -10, w: 40, h: 20 })).toBe(false);
  });

  it('hits a rect containing the apex', () => {
    expect(coneRect(beam(), { x: -20, y: -20, w: 40, h: 40 })).toBe(true);
  });

  it('hits a long thin bridge deck that straddles the cone', () => {
    // This is the footbridge: a 460x10 deck whose corners are all outside the
    // beam, but which the beam plainly crosses. If this returns false the
    // player falls through a bridge they can see.
    const deck = { x: -400, y: 60, w: 900, h: 10 };
    const aimed = beam({ angle: 0.45, length: 220 });
    expect(coneRect(aimed, deck)).toBe(true);
  });

  it('misses a deck that is genuinely out of the beam', () => {
    const deck = { x: -900, y: 300, w: 400, h: 10 };
    expect(coneRect(beam(), deck)).toBe(false);
  });

  it('reports a peak intensity for a rect it touches', () => {
    const r = { x: 60, y: -20, w: 40, h: 40 };
    expect(coneRectIntensity(beam(), r)).toBeGreaterThan(0);
    expect(coneRectIntensity(beam(), { x: -300, y: 0, w: 10, h: 10 })).toBe(0);
  });

  it('is unlit when the lamp is out (zero length)', () => {
    const dark = beam({ length: 0 });
    expect(coneRect(dark, { x: 80, y: -10, w: 40, h: 20 })).toBe(false);
  });
});
