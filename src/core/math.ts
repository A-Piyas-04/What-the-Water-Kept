/** Small allocation-free math helpers used by the simulation. */

export const clamp = (v: number, lo: number, hi: number): number =>
  v < lo ? lo : v > hi ? hi : v;

export const clamp01 = (v: number): number => clamp(v, 0, 1);

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export const inverseLerp = (a: number, b: number, v: number): number =>
  a === b ? 0 : clamp01((v - a) / (b - a));

/** Frame-rate independent exponential approach. `rate` is "units of catch-up per second". */
export const damp = (current: number, target: number, rate: number, dt: number): number =>
  lerp(current, target, 1 - Math.exp(-rate * dt));

export const smoothstep = (t: number): number => {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
};

export const smootherstep = (t: number): number => {
  const x = clamp01(t);
  return x * x * x * (x * (x * 6 - 15) + 10);
};

/** Move `current` toward `target` by at most `maxDelta`. */
export const moveToward = (current: number, target: number, maxDelta: number): number => {
  const d = target - current;
  if (Math.abs(d) <= maxDelta) return target;
  return current + Math.sign(d) * maxDelta;
};

export const sign0 = (v: number): number => (v > 0 ? 1 : v < 0 ? -1 : 0);

export const approxEqual = (a: number, b: number, eps = 1e-6): boolean =>
  Math.abs(a - b) <= eps;

export const wrapAngle = (a: number): number => {
  let r = a;
  while (r > Math.PI) r -= Math.PI * 2;
  while (r < -Math.PI) r += Math.PI * 2;
  return r;
};

export const dampAngle = (current: number, target: number, rate: number, dt: number): number =>
  current + wrapAngle(target - current) * (1 - Math.exp(-rate * dt));

export const distance2 = (ax: number, ay: number, bx: number, by: number): number => {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
};

export const distance = (ax: number, ay: number, bx: number, by: number): number =>
  Math.sqrt(distance2(ax, ay, bx, by));

export interface Vec2 {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const rectContains = (r: Rect, x: number, y: number): boolean =>
  x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

export const rectsOverlap = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

export const rectCenterX = (r: Rect): number => r.x + r.w * 0.5;
export const rectCenterY = (r: Rect): number => r.y + r.h * 0.5;

/** Shortest distance from a point to a rectangle (0 when inside). */
export const pointRectDistance = (r: Rect, x: number, y: number): number => {
  const dx = Math.max(r.x - x, 0, x - (r.x + r.w));
  const dy = Math.max(r.y - y, 0, y - (r.y + r.h));
  return Math.sqrt(dx * dx + dy * dy);
};
