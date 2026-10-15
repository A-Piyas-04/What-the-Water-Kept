import type { Rect } from '@/core/math';

export type ColliderKind =
  /** Blocks on every axis. */
  | 'solid'
  /** Blocks only a downward crossing - stairs, ledges, catwalks. */
  | 'oneway'
  /** Not solid; grants vertical traversal while overlapped. */
  | 'ladder'
  /** Not solid; forces the crouch state while overlapped. */
  | 'lowspace'
  /** Not solid; a lethal/scripted volume (open water, the gate race). */
  | 'hazard';

/** Which temporal layer a collider belongs to. */
export type Layer =
  /** Always present: today's silt, ruins and bedrock. */
  | 'present'
  /** Corran Mill as it was. Solid only while inside the lantern beam. */
  | 'before';

export interface Collider extends Rect {
  readonly kind: ColliderKind;
  readonly layer: Layer;
  /** Optional id so puzzles and doors can toggle a specific collider. */
  readonly id?: string;
  /**
   * When set, the collider is solid only while this flag is enabled at
   * runtime (opened doors, lowered bridges, drained rooms).
   */
  readonly requiresFlag?: string;
  /** Inverts `requiresFlag`: solid only while the flag is NOT set. */
  readonly blockedByFlag?: string;
}

export interface Body {
  x: number;
  y: number;
  /** Half-width of the AABB; `y` is the feet line, so the box is above it. */
  halfWidth: number;
  height: number;
  vx: number;
  vy: number;
  onGround: boolean;
  /** True while the body overlaps a ladder collider. */
  onLadder: boolean;
  /** True while the body overlaps a lowspace collider. */
  inLowSpace: boolean;
  /** True while the body overlaps a hazard collider. */
  inHazard: boolean;
  /** Set when a horizontal move was stopped by geometry this step. */
  blockedX: boolean;
}

export const bodyRect = (b: Body): Rect => ({
  x: b.x - b.halfWidth,
  y: b.y - b.height,
  w: b.halfWidth * 2,
  h: b.height,
});

export const makeBody = (x: number, y: number, halfWidth = 11, height = 56): Body => ({
  x,
  y,
  halfWidth,
  height,
  vx: 0,
  vy: 0,
  onGround: false,
  onLadder: false,
  inLowSpace: false,
  inHazard: false,
  blockedX: false,
});
