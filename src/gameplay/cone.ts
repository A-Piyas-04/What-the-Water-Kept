import { type Rect, clamp, rectContains, wrapAngle } from '@/core/math';

/**
 * The lantern beam as a geometric cone.
 *
 * This is the single most load-bearing piece of maths in the game: it decides
 * what the player can see of 1964, what is solid underfoot, and which of the
 * Drowned have just noticed the light. It is deliberately pure so the whole
 * mechanic can be tested without a renderer.
 */
export interface Cone {
  /** Apex, in world space. */
  readonly x: number;
  readonly y: number;
  /** Axis direction in radians (0 = +X). */
  readonly angle: number;
  /** Half-angle of the cone in radians. */
  readonly spread: number;
  /** Reach in world units. */
  readonly length: number;
}

/** Is a single point inside the cone? */
export const conePoint = (c: Cone, px: number, py: number): boolean => {
  const dx = px - c.x;
  const dy = py - c.y;
  const d2 = dx * dx + dy * dy;
  if (d2 > c.length * c.length) return false;
  // A generous near-field pool: standing on top of something lights it.
  if (d2 < 18 * 18) return true;
  return Math.abs(wrapAngle(Math.atan2(dy, dx) - c.angle)) <= c.spread;
};

/**
 * How strongly a point is lit, 0..1. Falls off with distance and with angle
 * from the axis, mirroring the beam texture so lighting and gameplay agree.
 */
export const coneIntensity = (c: Cone, px: number, py: number): number => {
  const dx = px - c.x;
  const dy = py - c.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d > c.length) return 0;
  if (d < 1) return 1;
  const off = Math.abs(wrapAngle(Math.atan2(dy, dx) - c.angle));
  if (off > c.spread) return 0;
  const radial = 1 - d / c.length;
  const angular = 1 - off / c.spread;
  return clamp(radial * 0.75 + radial * angular * 0.25, 0, 1) * (0.35 + angular * 0.65);
};

/** Nearest point of a rect to (x, y), clamped to the rect. */
const nearestOnRect = (r: Rect, x: number, y: number): [number, number] => [
  clamp(x, r.x, r.x + r.w),
  clamp(y, r.y, r.y + r.h),
];

/**
 * Does the cone touch any part of a rectangle?
 *
 * Tests, in order: apex inside the rect, the rect's nearest point to the apex,
 * the corners and edge midpoints, and finally whether the axis ray crosses the
 * rect. The sampled approach is intentional - an exact cone/AABB intersection
 * would be stricter than what the player perceives, and "the beam is clearly
 * on it but it is not solid" is a far worse bug than the reverse.
 */
export const coneRect = (c: Cone, r: Rect): boolean => {
  if (rectContains(r, c.x, c.y)) return true;

  const [nx, ny] = nearestOnRect(r, c.x, c.y);
  if (conePoint(c, nx, ny)) return true;

  const x0 = r.x;
  const x1 = r.x + r.w;
  const y0 = r.y;
  const y1 = r.y + r.h;
  const mx = r.x + r.w * 0.5;
  const my = r.y + r.h * 0.5;
  const samples: Array<[number, number]> = [
    [x0, y0], [x1, y0], [x0, y1], [x1, y1],
    [mx, y0], [mx, y1], [x0, my], [x1, my],
    [mx, my],
  ];
  for (const [sx, sy] of samples) if (conePoint(c, sx, sy)) return true;

  // Long thin colliders (a bridge deck, a rail) can straddle the cone with
  // every sample outside it. Walk the axis and test containment.
  const steps = 10;
  for (let i = 1; i <= steps; i++) {
    const t = (i / steps) * c.length;
    const px = c.x + Math.cos(c.angle) * t;
    const py = c.y + Math.sin(c.angle) * t;
    if (rectContains(r, px, py)) return true;
  }

  // ...and sample the two cone edges for the same reason.
  for (const edge of [c.angle - c.spread, c.angle + c.spread]) {
    for (let i = 1; i <= steps; i++) {
      const t = (i / steps) * c.length;
      const px = c.x + Math.cos(edge) * t;
      const py = c.y + Math.sin(edge) * t;
      if (rectContains(r, px, py)) return true;
    }
  }

  return false;
};

/** Peak intensity anywhere on a rect - used to wake the Drowned. */
export const coneRectIntensity = (c: Cone, r: Rect): number => {
  const [nx, ny] = nearestOnRect(r, c.x, c.y);
  let best = coneIntensity(c, nx, ny);
  const mx = r.x + r.w * 0.5;
  for (const [sx, sy] of [
    [mx, r.y + r.h * 0.5],
    [mx, r.y],
    [mx, r.y + r.h],
    [r.x, r.y + r.h * 0.5],
    [r.x + r.w, r.y + r.h * 0.5],
  ] as Array<[number, number]>) {
    const i = coneIntensity(c, sx, sy);
    if (i > best) best = i;
  }
  return best;
};
