import type { Collider, ColliderKind, Layer } from '@/physics/types';
import type { InteractableDef, PropPlacement, TriggerDef } from './types';

/**
 * Scene-authoring helpers.
 *
 * Scenes are plain data, which keeps level design testable and keeps the
 * renderer out of the content. These helpers exist only to make that data
 * readable: `floor(0, 1200)` instead of a six-field object literal.
 *
 * Convention: y = 0 is the gameplay ground line, +y is down, and props use a
 * bottom-left origin. Every collider is authored in world units.
 */

const THICK = 400;

export const col = (
  kind: ColliderKind,
  x: number,
  y: number,
  w: number,
  h: number,
  extra: Partial<Collider> = {},
): Collider => ({ kind, layer: 'present', x, y, w, h, ...extra });

/** Solid ground from x0 to x1 with its surface at `top`. */
export const floor = (
  x0: number,
  x1: number,
  top = 0,
  extra: Partial<Collider> = {},
): Collider => col('solid', x0, top, x1 - x0, THICK, extra);

/** A vertical wall. `h` grows upward from `base`. */
export const wall = (
  x: number,
  base: number,
  w: number,
  h: number,
  extra: Partial<Collider> = {},
): Collider => col('solid', x, base - h, w, h, extra);

/** A ceiling, to stop the player leaving an interior upward. */
export const ceiling = (x0: number, x1: number, y: number): Collider =>
  col('solid', x0, y - THICK, x1 - x0, THICK);

/** A step-through platform: stairs, catwalks, a bridge deck. */
export const deck = (
  x0: number,
  x1: number,
  top: number,
  extra: Partial<Collider> = {},
): Collider => col('oneway', x0, top, x1 - x0, 10, extra);

export const ladder = (x: number, top: number, bottom: number, w = 26): Collider =>
  col('ladder', x - w / 2, top, w, bottom - top);

/** Forces a crouch while overlapped. */
export const lowspace = (
  x0: number,
  x1: number,
  top: number,
  h = 40,
  extra: Partial<Collider> = {},
): Collider => col('lowspace', x0, top, x1 - x0, h, extra);

export const hazard = (x0: number, x1: number, top: number, h = 300): Collider =>
  col('hazard', x0, top, x1 - x0, h);

/** The tallest lip the player walks over; mirrors STEP_UP in the solver. */
export const STEP = 11;

/**
 * A walkable slope, as a staircase of small overlapping steps.
 *
 * The solver lets the player walk over a lip of up to 14px and no more, which
 * is correct - anything taller should read as a climb. The consequence is that
 * level authors cannot simply butt two floors of different heights together
 * and expect to get through, so every height change goes through here and is
 * guaranteed traversable in both directions.
 */
export const ramp = (
  x0: number,
  x1: number,
  fromY: number,
  toY: number,
  extra: Partial<Collider> = {},
): Collider[] => {
  const rise = toY - fromY;
  const steps = Math.max(1, Math.ceil(Math.abs(rise) / STEP));
  const out: Collider[] = [];
  const span = (x1 - x0) / steps;
  for (let i = 0; i < steps; i++) {
    const y = fromY + (rise * (i + 1)) / steps;
    // Each tread overlaps the next so there is never a gap to fall into.
    out.push(floor(x0 + span * i, x0 + span * (i + 1) + 2, y, extra));
  }
  return out;
};

/**
 * An opening the player has to crouch through.
 *
 * A solid mass hangs from the ceiling down to `gap` above the floor, and a
 * lowspace volume fills the gap so the locomotion state machine forces - and
 * holds - the crouch. Authoring this as a bare wall plus a lowspace (which is
 * what the first draft of these scenes did) produces a wall the player simply
 * cannot pass, because a lowspace does not remove solidity.
 */
export const crawl = (
  x0: number,
  x1: number,
  floorY: number,
  gap = 40,
  headroom = 230,
  extra: Partial<Collider> = {},
): Collider[] => [
  col('solid', x0, floorY - headroom, x1 - x0, headroom - gap, extra),
  // The lowspace reaches a little past the opening on both sides. That margin
  // is what makes the crouch automatic: walking up to a low gap drops her
  // without the player having to work out that a crouch is required, and
  // without the gap becoming a wall for anyone who does not.
  col('lowspace', x0 - CRAWL_MARGIN, floorY - gap, x1 - x0 + CRAWL_MARGIN * 2, gap, extra),
];

/** How far the forced-crouch volume reaches beyond a crawl opening. */
const CRAWL_MARGIN = 26;

/** The same helpers, but on the Before layer - solid only while lit. */
export const beforeFloor = (
  x0: number,
  x1: number,
  top = 0,
  extra: Partial<Collider> = {},
): Collider => ({ ...floor(x0, x1, top, extra), layer: 'before' as Layer });

export const beforeDeck = (
  x0: number,
  x1: number,
  top: number,
  extra: Partial<Collider> = {},
): Collider => ({ ...deck(x0, x1, top, extra), layer: 'before' as Layer });

/**
 * A thin solid slab on the Before layer: a bridge deck, a catwalk plate.
 *
 * Unlike `beforeDeck` this is fully solid rather than one-way, which is what
 * lets the player walk straight onto it from level ground - a one-way platform
 * a few pixels above the street is something she would walk underneath.
 */
export const beforeSlab = (
  x0: number,
  x1: number,
  top: number,
  extra: Partial<Collider> = {},
): Collider => ({
  ...col('solid', x0, top, x1 - x0, 14, extra),
  layer: 'before' as Layer,
});

export const beforeWall = (
  x: number,
  base: number,
  w: number,
  h: number,
  extra: Partial<Collider> = {},
): Collider => ({ ...wall(x, base, w, h, extra), layer: 'before' as Layer });

export const beforeLadder = (x: number, top: number, bottom: number, w = 26): Collider => ({
  ...ladder(x, top, bottom, w),
  layer: 'before' as Layer,
});

/** A rectangular interaction/trigger zone centred on a point. */
export const box = (
  x: number,
  y: number,
  w: number,
  h: number,
): { x: number; y: number; w: number; h: number } => ({ x: x - w / 2, y: y - h, w, h });

/** Shorthand for a prop placement. */
export const prop = (
  name: string,
  x: number,
  y: number,
  depth: number,
  params: PropPlacement['params'] = {},
  extra: Partial<PropPlacement> = {},
): PropPlacement => ({ prop: name, x, y, depth, params, ...extra });

/** A Before-layer prop placement. */
export const bprop = (
  name: string,
  x: number,
  y: number,
  depth: number,
  params: PropPlacement['params'] = {},
  extra: Partial<PropPlacement> = {},
): PropPlacement => ({ prop: name, x, y, depth, layer: 'before', params, ...extra });

/** An examine-only interactable. */
export const look = (
  id: string,
  x: number,
  y: number,
  label: string,
  textId: string,
  extra: Partial<InteractableDef> = {},
): InteractableDef => ({
  id,
  zone: box(x, y, 92, 110),
  kind: 'examine',
  verb: 'Look',
  label,
  textId,
  ...extra,
});

/** A document: examine, grant a clue, and file it in the journal. */
export const document = (
  id: string,
  x: number,
  y: number,
  label: string,
  textId: string,
  clueId: string,
  extra: Partial<InteractableDef> = {},
): InteractableDef => ({
  id,
  zone: box(x, y, 92, 120),
  kind: 'clue',
  verb: 'Read',
  label,
  textId,
  clueId,
  ...extra,
});

export const pickup = (
  id: string,
  x: number,
  y: number,
  label: string,
  itemId: string,
  textId: string,
  extra: Partial<InteractableDef> = {},
): InteractableDef => ({
  id,
  zone: box(x, y, 96, 120),
  kind: 'pickup',
  verb: 'Take',
  label,
  itemId,
  textId,
  once: true,
  ...extra,
});

export const doorway = (
  id: string,
  x: number,
  y: number,
  label: string,
  exitTo: InteractableDef['exitTo'],
  exitSpawn: string,
  extra: Partial<InteractableDef> = {},
): InteractableDef => ({
  id,
  zone: box(x, y, 90, 120),
  kind: 'door',
  verb: 'Enter',
  label,
  exitTo,
  exitSpawn,
  ...extra,
});

/** A story trigger: fires narration the first time the player walks through. */
export const beat = (
  id: string,
  x: number,
  w: number,
  textId: string,
  extra: Partial<TriggerDef> = {},
): TriggerDef => ({
  id,
  zone: { x: x - w / 2, y: -260, w, h: 400 },
  kind: 'story',
  once: true,
  textId,
  ...extra,
});

export const checkpoint = (id: string, x: number, spawnId: string, w = 140): TriggerDef => ({
  id,
  zone: { x: x - w / 2, y: -260, w, h: 400 },
  kind: 'checkpoint',
  once: false,
  checkpointId: spawnId,
});

export const framing = (
  id: string,
  x: number,
  w: number,
  camera: TriggerDef['camera'],
): TriggerDef => ({
  id,
  zone: { x: x - w / 2, y: -320, w, h: 460 },
  kind: 'camera',
  camera,
});

export const exitZone = (
  id: string,
  x: number,
  w: number,
  exitTo: TriggerDef['exitTo'],
  exitSpawn: string,
  extra: Partial<TriggerDef> = {},
): TriggerDef => ({
  id,
  zone: { x: x - w / 2, y: -260, w, h: 400 },
  kind: 'exit',
  exitTo,
  exitSpawn,
  ...extra,
});

/** A row of repeated props, for fences, rails, cobbles and pipe runs. */
export const run = (
  name: string,
  x0: number,
  x1: number,
  step: number,
  y: number,
  depth: number,
  params: PropPlacement['params'] = {},
): PropPlacement[] => {
  const out: PropPlacement[] = [];
  for (let x = x0; x < x1; x += step) out.push(prop(name, x, y, depth, params));
  return out;
};

export const brun = (
  name: string,
  x0: number,
  x1: number,
  step: number,
  y: number,
  depth: number,
  params: PropPlacement['params'] = {},
): PropPlacement[] => {
  const out: PropPlacement[] = [];
  for (let x = x0; x < x1; x += step) out.push(bprop(name, x, y, depth, params));
  return out;
};
