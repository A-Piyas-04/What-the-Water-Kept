import { Container, Graphics } from 'pixi.js';
import { Rng, hashSeed } from '@/core/rng';
import type { PropPlacement } from '@/world/types';
import { type PropCtx, type PropDraw } from './context';
import * as architecture from './architecture';
import * as nature from './nature';
import * as industrial from './industrial';
import * as interior from './interior';
import * as misc from './misc';

export const PROPS: Readonly<Record<string, PropDraw>> = {
  // Architecture
  facade: architecture.facade,
  tower: architecture.tower,
  roofline: architecture.roofline,
  wallmass: architecture.wallmass,
  rubble: architecture.rubble,
  doorframe: architecture.doorframe,
  stair: architecture.stair,
  railing: architecture.railing,
  // Nature / reservoir bed
  silt: nature.silt,
  hills: nature.hills,
  deadtree: nature.deadtree,
  waterline: nature.waterline,
  reeds: nature.reeds,
  weedcurtain: nature.weedcurtain,
  fenceline: nature.fenceline,
  // Industrial
  girder: industrial.girder,
  piperun: industrial.piperun,
  rails: industrial.rails,
  minecart: industrial.minecart,
  winch: industrial.winch,
  counterweight: industrial.counterweight,
  valve: industrial.valve,
  machine: industrial.machine,
  controldesk: industrial.controldesk,
  dialface: industrial.dialface,
  sluicegate: industrial.sluicegate,
  // Interior
  interiorwall: interior.interiorwall,
  windowtall: interior.windowtall,
  furniture: interior.furniture,
  chalkboard: interior.chalkboard,
  chalkglyph: interior.chalkglyph,
  curtain: interior.curtain,
  hanginglamp: interior.hanginglamp,
  lamppost: interior.lamppost,
  // Misc
  tent: misc.tent,
  tripod: misc.tripod,
  boatwreck: misc.boatwreck,
  sign: misc.sign,
  surveylamp: misc.surveylamp,
  clockface: misc.clockface,
  paper: misc.paper,
  smallobject: misc.smallobject,
  groundstrip: misc.groundstrip,
};

export const propExists = (name: string): boolean => name in PROPS;

/**
 * Builds one placed prop into its own Container.
 *
 * Each placement gets its own deterministic Rng, seeded from the prop name and
 * position, so the same building has the same broken windows every run - and
 * after every save/load.
 */
export const buildProp = (placement: PropPlacement): Container | null => {
  const draw = PROPS[placement.prop];
  if (!draw) {
    if (import.meta.env?.DEV) console.warn(`[props] unknown prop "${placement.prop}"`);
    return null;
  }

  const root = new Container();
  const g = new Graphics();
  root.addChild(g);

  const params = placement.params ?? {};
  const seed = hashSeed(
    `${placement.prop}:${Math.round(placement.x)}:${Math.round(placement.y)}:${placement.depth}`,
  );
  const ctx: PropCtx = {
    g,
    root,
    rng: new Rng(seed),
    layer: placement.layer ?? 'present',
    num: (key, fallback) => {
      const raw = params[key];
      return typeof raw === 'number' ? raw : fallback;
    },
    str: (key, fallback) => {
      const raw = params[key];
      return typeof raw === 'string' ? raw : fallback;
    },
    bool: (key, fallback) => {
      const raw = params[key];
      return typeof raw === 'boolean' ? raw : fallback;
    },
  };

  draw(ctx);

  root.x = placement.x;
  root.y = placement.y;
  if (placement.scale !== undefined) root.scale.set(placement.scale);
  if (placement.flip) root.scale.x = -Math.abs(root.scale.x);
  if (placement.alpha !== undefined) root.alpha = placement.alpha;
  if (placement.tint !== undefined) root.tint = placement.tint;
  return root;
};

export { type PropCtx, type PropDraw } from './context';
export { v, vw, vl } from './context';
