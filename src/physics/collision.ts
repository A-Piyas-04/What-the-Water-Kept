import { type Rect, rectsOverlap } from '@/core/math';
import { type Body, bodyRect, type Collider, type ColliderKind } from './types';

/** Tells the solver which Before-layer colliders are currently lit (solid). */
export interface SolidityQuery {
  /** Is this Before-layer collider inside the lantern beam right now? */
  isBeforeLit(c: Collider): boolean;
  /** Is a runtime flag (door opened, bridge lowered) set? */
  hasFlag(flag: string): boolean;
}

export const ALWAYS_PRESENT: SolidityQuery = {
  isBeforeLit: () => false,
  hasFlag: () => false,
};

/**
 * Static collision set for one scene.
 *
 * Deliberately a flat array with a coarse horizontal bucket index rather than
 * a general spatial tree: scenes hold a few hundred colliders, buckets keep
 * the per-step scan allocation-free, and the result is fully deterministic.
 */
export class CollisionWorld {
  private readonly colliders: Collider[] = [];
  private buckets: Collider[][] = [];
  private bucketSize = 256;
  private minX = 0;

  constructor(colliders: readonly Collider[] = []) {
    for (const c of colliders) this.colliders.push(c);
    this.reindex();
  }

  get all(): readonly Collider[] {
    return this.colliders;
  }

  add(c: Collider): void {
    this.colliders.push(c);
    this.reindex();
  }

  private reindex(): void {
    this.minX = this.colliders.length
      ? Math.min(...this.colliders.map((c) => c.x))
      : 0;
    const maxX = this.colliders.length
      ? Math.max(...this.colliders.map((c) => c.x + c.w))
      : 0;
    const count = Math.max(1, Math.ceil((maxX - this.minX) / this.bucketSize) + 1);
    this.buckets = Array.from({ length: count }, () => []);
    for (const c of this.colliders) {
      const from = this.bucketIndex(c.x);
      const to = this.bucketIndex(c.x + c.w);
      for (let i = from; i <= to; i++) this.buckets[i].push(c);
    }
  }

  private bucketIndex(x: number): number {
    const i = Math.floor((x - this.minX) / this.bucketSize);
    return Math.min(this.buckets.length - 1, Math.max(0, i));
  }

  /** Candidate colliders overlapping a rect's horizontal span. */
  candidates(r: Rect): readonly Collider[] {
    if (this.buckets.length === 1) return this.buckets[0];
    const from = this.bucketIndex(r.x);
    const to = this.bucketIndex(r.x + r.w);
    if (from === to) return this.buckets[from];
    const out: Collider[] = [];
    for (let i = from; i <= to; i++) {
      for (const c of this.buckets[i]) if (!out.includes(c)) out.push(c);
    }
    return out;
  }

  /**
   * Whether a collider currently participates in collision.
   *
   * This is the heart of the lantern mechanic: a Before-layer collider is a
   * real wall or floor only while the beam is on it.
   */
  isActive(c: Collider, q: SolidityQuery): boolean {
    if (c.requiresFlag && !q.hasFlag(c.requiresFlag)) return false;
    if (c.blockedByFlag && q.hasFlag(c.blockedByFlag)) return false;
    if (c.layer === 'before' && !q.isBeforeLit(c)) return false;
    return true;
  }

  private activeOfKind(r: Rect, kind: ColliderKind, q: SolidityQuery): Collider | null {
    for (const c of this.candidates(r)) {
      if (c.kind !== kind) continue;
      if (!this.isActive(c, q)) continue;
      if (rectsOverlap(r, c)) return c;
    }
    return null;
  }

  overlaps(r: Rect, kind: ColliderKind, q: SolidityQuery): boolean {
    return this.activeOfKind(r, kind, q) !== null;
  }

  /** True when the rect intersects anything that blocks horizontal movement. */
  blocked(r: Rect, q: SolidityQuery): boolean {
    return this.activeOfKind(r, 'solid', q) !== null;
  }
}

const EPSILON = 0.001;

/**
 * Skin depth for de-penetration.
 *
 * A grounded body is deliberately seated a hair inside its floor so that the
 * overlap test keeps reporting contact. De-penetration therefore has to ignore
 * that hair, or it fires every single step and cancels the body's velocity -
 * which is exactly the bug this constant exists to prevent.
 */
const SKIN = 0.6;

/**
 * How high a lip the body walks straight over.
 *
 * Side-view walkers need this: cobbles, a sprung floorboard, the edge of a
 * rubble pile and a kerb are all obstacles the player would never expect to
 * stop them, and without a step tolerance each one is a wall. Anything taller
 * than this is a real climb and blocks.
 */
const STEP_UP = 14;

/**
 * Pushes a body out of any solid it is already deeply overlapping.
 *
 * Without this, the axis-separated solver resolves purely by direction of
 * travel: a body that starts inside a wall gets ejected to whichever side it
 * happened to be moving, which can put it outside the world entirely. That is
 * the kind of fault that turns into an unrecoverable fall, so the solver
 * refuses to create it: a trapped body always leaves by its nearest face.
 */
export const depenetrate = (body: Body, world: CollisionWorld, q: SolidityQuery): boolean => {
  let moved = false;
  // A few passes, because leaving one collider can enter another.
  for (let pass = 0; pass < 3; pass++) {
    const full = bodyRect(body);
    // Shrunk by the skin, so resting contact is not treated as penetration.
    const probe: Rect = {
      x: full.x + SKIN,
      y: full.y + SKIN,
      w: full.w - SKIN * 2,
      h: Math.max(1, full.h - SKIN - STEP_UP),
    };
    let hit: Collider | null = null;
    for (const c of world.candidates(probe)) {
      if (c.kind !== 'solid' || !world.isActive(c, q)) continue;
      if (rectsOverlap(probe, c)) {
        hit = c;
        break;
      }
    }
    if (!hit) return moved;

    // Overlap depth on each of the four faces, measured on the real rect.
    const left = full.x + full.w - hit.x;
    const right = hit.x + hit.w - full.x;
    const up = full.y + full.h - hit.y;
    const down = hit.y + hit.h - full.y;
    const min = Math.min(left, right, up, down);

    if (min === up) {
      body.y = hit.y + EPSILON;
      if (body.vy > 0) body.vy = 0;
      body.onGround = true;
    } else if (min === down) {
      body.y = hit.y + hit.h + body.height + EPSILON;
      if (body.vy < 0) body.vy = 0;
    } else if (min === left) {
      body.x = hit.x - body.halfWidth - EPSILON;
      // Only a horizontal ejection cancels horizontal motion.
      body.vx = 0;
      body.blockedX = true;
    } else {
      body.x = hit.x + hit.w + body.halfWidth + EPSILON;
      body.vx = 0;
      body.blockedX = true;
    }
    moved = true;
  }
  return moved;
};

/** Result of one solver step, for animation and audio to react to. */
export interface MoveResult {
  hitWall: boolean;
  landed: boolean;
  hitCeiling: boolean;
}

/**
 * Axis-separated swept AABB resolution.
 *
 * Horizontal first, then vertical: for a side-view walker this gives stable
 * behaviour against floors and lets us treat `oneway` colliders (stairs,
 * catwalks) as floors only when descending onto them.
 */
export const moveBody = (
  body: Body,
  dt: number,
  world: CollisionWorld,
  q: SolidityQuery,
): MoveResult => {
  const result: MoveResult = { hitWall: false, landed: false, hitCeiling: false };
  const wasOnGround = body.onGround;
  body.blockedX = false;

  // If a previous step, a scene load or a restored save left the body inside
  // geometry, leave by the nearest face before doing anything else.
  depenetrate(body, world, q);

  // --- Horizontal ---
  //
  // The body is seated a hair inside whatever it is standing on, so testing
  // the full rect here would treat its own floor as a wall - and then cascade
  // it along every collider in the bucket. The horizontal test therefore uses
  // a rect inset at the bottom by the step tolerance and at the top by the
  // skin: only geometry that genuinely obstructs the torso can stop her.
  const dx = body.vx * dt;
  if (dx !== 0) {
    body.x += dx;
    const r = bodyRect(body);
    const hRect: Rect = {
      x: r.x,
      y: r.y + SKIN,
      w: r.w,
      h: Math.max(1, r.h - SKIN - STEP_UP),
    };
    for (const c of world.candidates(hRect)) {
      if (c.kind !== 'solid' || !world.isActive(c, q)) continue;
      if (!rectsOverlap(hRect, c)) continue;
      if (dx > 0) body.x = c.x - body.halfWidth - EPSILON;
      else body.x = c.x + c.w + body.halfWidth + EPSILON;
      body.vx = 0;
      body.blockedX = true;
      result.hitWall = true;
      hRect.x = body.x - body.halfWidth;
    }
  }

  // --- Vertical ---
  const dy = body.vy * dt;
  body.onGround = false;
  if (dy !== 0) {
    body.y += dy;
    const r = bodyRect(body);
    for (const c of world.candidates(r)) {
      if (!world.isActive(c, q)) continue;
      const isFloorish = c.kind === 'solid' || c.kind === 'oneway';
      if (!isFloorish) continue;
      if (!rectsOverlap(r, c)) continue;

      if (dy > 0) {
        // Falling. A one-way collider only catches a body whose feet were
        // above its surface before the step.
        if (c.kind === 'oneway') {
          const feetBefore = body.y - dy;
          if (feetBefore > c.y + EPSILON) continue;
        }
        body.y = c.y + EPSILON;
        body.vy = 0;
        body.onGround = true;
        if (!wasOnGround) result.landed = true;
      } else if (c.kind === 'solid') {
        body.y = c.y + c.h + body.height + EPSILON;
        body.vy = 0;
        result.hitCeiling = true;
      }
      r.y = body.y - body.height;
    }
  }

  // --- Volume queries ---
  const r = bodyRect(body);
  body.onLadder = world.overlaps(r, 'ladder', q);
  body.inLowSpace = world.overlaps(r, 'lowspace', q);
  body.inHazard = world.overlaps(r, 'hazard', q);

  // Standing still on a floor: re-probe one pixel below so `onGround` is
  // stable for the animation state machine even on a zero-velocity step.
  if (!body.onGround && body.vy >= 0) {
    const probe: Rect = { x: r.x, y: r.y + 1, w: r.w, h: r.h };
    for (const c of world.candidates(probe)) {
      if (!world.isActive(c, q)) continue;
      if (c.kind !== 'solid' && c.kind !== 'oneway') continue;
      if (!rectsOverlap(probe, c)) continue;
      if (Math.abs(body.y - c.y) <= 1.5) {
        body.onGround = true;
        break;
      }
    }
  }

  return result;
};

/** Drops a body to the nearest floor below - used when restoring a save. */
export const settleOnGround = (
  body: Body,
  world: CollisionWorld,
  q: SolidityQuery,
  maxDrop = 600,
): boolean => {
  for (let d = 0; d < maxDrop; d += 2) {
    const r: Rect = {
      x: body.x - body.halfWidth,
      y: body.y - body.height + d,
      w: body.halfWidth * 2,
      h: body.height,
    };
    for (const c of world.candidates(r)) {
      if (c.kind !== 'solid' && c.kind !== 'oneway') continue;
      if (!world.isActive(c, q)) continue;
      if (rectsOverlap(r, c)) {
        body.y = c.y + EPSILON;
        body.vy = 0;
        body.onGround = true;
        return true;
      }
    }
  }
  return false;
};
