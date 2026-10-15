import { PALETTES } from '@/rendering/palette';
import type { Collider } from '@/physics/types';
import type { InteractableDef, PropPlacement, SceneDef, TriggerDef } from '@/world/types';
import {
  beat,
  beforeDeck,
  beforeFloor,
  bprop,
  brun,
  ceiling,
  checkpoint,
  document,
  exitZone,
  floor,
  framing,
  crawl,
  lowspace,
  ladder,
  look,
  pickup,
  prop,
  ramp,
  wall,
} from '@/world/build';

/**
 * CHAPTER IV - The Mill Tunnels
 *
 * The chapter where the mystery resolves into a document, and the one puzzle
 * that is purely mechanical.
 *
 * The counterweight cart holds a collapsed roof beam clear of the passage.
 * The rail and the winch cable only exist in 1964, so the beam has to be on
 * the rail for the crank to bite - but the winch has a ratchet, so nothing is
 * ever lost. Discovering the ratchet is the whole puzzle: players arrive
 * expecting to need two hands and find they only need patience.
 *
 * Martin is down here, at the tunnel mouth, facing the gatehouse.
 */

const G = 0;
const CEIL = -170;

const colliders: Collider[] = [
  floor(-120, 980, G),
  // A step down into the lower gallery, with a ladder as the way back up.
  ...ramp(950, 1010, G, 48),
  floor(1000, 1080, 48),
  ...ramp(1070, 1110, 48, 72),
  floor(1100, 2060, 72),
  // The passage the beam blocks.
  floor(2040, 2500, 72),
  // Up to the gatehouse stair.
  ...ramp(2470, 2590, 72, 20),
  floor(2580, 2650, 20),
  ...ramp(2640, 2760, 20, -34),
  floor(2750, 2820, -34),
  ...ramp(2810, 2930, -34, -86),
  floor(2920, 3200, -86),
  ceiling(-120, 980, CEIL),
  ceiling(1060, 2500, CEIL + 90),
  ceiling(2700, 3200, CEIL - 20),
  wall(-180, G, 60, 400),
  wall(3200, -86, 70, 400),
  // A duct she has to crouch along to reach the ledger alcove.
  ...crawl(380, 560, G, 42, 160),
  // The ladder down into the lower gallery, as an alternative to the steps.
  ladder(1030, -10, 76, 34),
  // THE BEAM. Impassable until the cart is wound up.
  wall(2180, 72, 34, 150, { id: 'tunnel-beam', blockedByFlag: 'tunnel-beam-raised' }),
  lowspace(2140, 2260, 20, 54, { requiresFlag: 'tunnel-beam-raised' }),
];

const beforeColliders: Collider[] = [
  beforeFloor(-120, 980, -4),
  beforeFloor(1060, 2500, 68),
  beforeDeck(2480, 2620, 16),
  beforeDeck(2580, 2740, -38),
  beforeDeck(2700, 3200, -90),
  // The rail the cart runs on. Present only in the beam - this is what the
  // counterweight puzzle is physically about.
  beforeDeck(1500, 2100, 48, { id: 'cart-rail' }),
];

const props: PropPlacement[] = [
  // --- Tunnel fabric ---
  prop('wallmass', -120, G, 2, { w: 1200, h: 240, value: 0.13, lift: 40, panel: 80, tide: 90 }),
  prop('wallmass', 1060, 72, 2, { w: 1500, h: 250, value: 0.12, lift: 40, tide: 100 }),
  prop('wallmass', 2580, -34, 2, { w: 700, h: 260, value: 0.13, lift: 40, tide: 60 }),
  prop('groundstrip', -120, G, 4, { w: 1100, style: 'grating', value: 0.12 }),
  prop('groundstrip', 1060, 72, 4, { w: 1450, style: 'grating', value: 0.12 }),
  prop('girder', -120, CEIL + 30, 3, { w: 1150, h: 24, style: 'beam' }),
  prop('girder', 1060, CEIL + 120, 3, { w: 1450, h: 24, style: 'beam' }),
  ...[200, 520, 840].map((x) => prop('girder', x, G, 3, { w: 22, h: 170, style: 'beam', vertical: true })),
  ...[1300, 1700, 2100].map((x) => prop('girder', x, 72, 3, { w: 22, h: 160, style: 'beam', vertical: true })),

  // --- Pipes and water ---
  prop('piperun', -120, -40, 4, { len: 1100, r: 14, value: 0.16, joint: 120 }),
  prop('piperun', 1060, 20, 4, { len: 1450, r: 12, value: 0.15, joint: 110 }),
  prop('piperun', 300, CEIL + 54, 3, { len: 700, r: 9, value: 0.14, brackets: false }),
  prop('valve', 760, -62, 5, { r: 19, spokes: 5, angle: 0.4 }),
  prop('waterline', 1100, 72, 4, { w: 380, d: 22, value: 0.1 }),
  prop('weedcurtain', 240, CEIL + 40, 5, { w: 180, h: 90 }),
  prop('weedcurtain', 1340, CEIL + 130, 5, { w: 220, h: 100 }),
  prop('weedcurtain', 2000, CEIL + 130, 5, { w: 180, h: 80 }),

  // --- The ledger alcove ---
  prop('doorframe', 370, G, 4, { w: 40, h: 76, open: true }),
  prop('furniture', 460, -56, 4, { style: 'shelf', w: 58, h: 56 }),
  prop('paper', 470, -92, 5, { w: 32, h: 42, lines: 7 }),
  prop('furniture', 620, G, 4, { style: 'crate', w: 44, h: 36 }),

  // --- The winch and the crank ---
  prop('winch', 1200, 72, 4, { w: 66, h: 76 }),
  prop('furniture', 1320, 72, 4, { style: 'crate', w: 40, h: 32 }),
  prop('smallobject', 900, G, 5, { style: 'satchel', s: 1 }),

  // --- The rail, the cart and the beam (present-day: broken) ---
  prop('rails', 1500, 48, 4, { w: 600, gauge: 34 }),
  prop('rubble', 2140, 72, 4, { w: 180, h: 70 }),
  prop('girder', 2160, 222, 5, { w: 180, h: 30, style: 'beam' }),
  prop('rubble', 2260, 72, 5, { w: 200, h: 80 }),

  // --- The stair up to the gatehouse ---
  prop('stair', 2480, 72, 4, { steps: 4, rise: 13, run: 24, dir: 1, w: 1 }),
  prop('stair', 2580, 20, 4, { steps: 4, rise: 13, run: 22, dir: 1, w: 1 }),
  prop('stair', 2700, -34, 4, { steps: 4, rise: 13, run: 22, dir: 1, w: 1 }),
  prop('doorframe', 3060, -86, 4, { w: 52, h: 100, open: true, arch: true }),
  prop('machine', 2820, -86, 4, { w: 150, h: 120 }),

  // --- Foreground ---
  prop('piperun', -120, G + 40, 6, { len: 900, r: 20, value: 0.05, joint: 160 }),
  prop('rubble', 1600, 72 + 30, 6, { w: 300, h: 90 }),
  prop('weedcurtain', 2400, CEIL + 150, 6, { w: 260, h: 140 }),

  // --- 1964: a working tunnel, lamplit, dry ---
  bprop('wallmass', -120, -4, 3, { w: 1200, h: 240, value: 0.3, lift: 40, tide: 0 }),
  bprop('wallmass', 1060, 68, 3, { w: 1500, h: 250, value: 0.3, lift: 40, tide: 0 }),
  bprop('groundstrip', -120, -4, 4, { w: 1100, style: 'boards', value: 0.32 }),
  bprop('groundstrip', 1060, 68, 4, { w: 1450, style: 'boards', value: 0.32 }),
  ...brun('hanginglamp', 200, 980, 260, CEIL + 30, 4, { cord: 40, r: 14, lit: true }),
  ...brun('hanginglamp', 1200, 2450, 300, CEIL + 120, 4, { cord: 40, r: 14, lit: true }),
  bprop('rails', 1500, 48, 4, { w: 600, gauge: 34 }),
  bprop('winch', 1200, 68, 4, { w: 66, h: 76 }),
  bprop('piperun', -120, -44, 4, { len: 1100, r: 14, value: 0.3, joint: 120 }),
  bprop('piperun', 1060, 16, 4, { len: 1450, r: 12, value: 0.3, joint: 110 }),
  ...brun('furniture', 300, 900, 200, -4, 4, { style: 'crate', w: 44, h: 36 }),
  bprop('machine', 2820, -90, 4, { w: 150, h: 120 }),
  bprop('stair', 2480, 68, 4, { steps: 5, rise: 12, run: 22, dir: 1 }),
];

const interactables: InteractableDef[] = [
  document(
    'tunnels-ledger',
    470,
    -56,
    'Gate ledger',
    'tunnels-ledger',
    'clue-ledger',
    { setsFlag: 'read-ledger', requiresLight: true },
  ),
  pickup('tunnels-crank', 900, G, 'Winch crank', 'item-crank', 'tunnels-cart', {
    requiresLight: true,
  }),
  {
    id: 'tunnels-winch',
    zone: { x: 1180, y: 72 - 100, w: 120, h: 100 },
    kind: 'puzzle',
    verb: 'Crank',
    label: 'The winch',
    puzzleId: 'puzzle-counterweight',
    requiresItem: 'item-crank',
    lockedTextId: 'tunnels-cart',
  },
  look('tunnels-martin', 2340, 72, 'A small figure', 'tunnels-martin', {
    requiresLight: true,
    requiresFlag: 'tunnel-beam-raised',
  }),
];

const triggers: TriggerDef[] = [
  beat('tunnels-arrive', -40, 240, 'tunnels-arrive'),
  checkpoint('tunnels-cp-west', 60, 'west'),
  framing('tunnels-frame-alcove', 470, 240, { zoom: 1.12 }),
  {
    id: 'tunnels-ec',
    zone: { x: 700, y: -300, w: 300, h: 460 },
    kind: 'story',
    once: true,
    textId: 'tunnels-ec',
    requiresFlag: 'read-ledger',
    setsFlag: 'knows-ec',
    checkpointId: 'ledger',
  },
  checkpoint('tunnels-cp-ledger', 720, 'ledger'),
  framing('tunnels-frame-winch', 1500, 900, { zoom: 0.9, offsetY: -20 }),
  checkpoint('tunnels-cp-winch', 1180, 'winch'),
  checkpoint('tunnels-cp-passage', 2300, 'passage'),
  exitZone('tunnels-exit-gatehouse', 3100, 110, 'gatehouse', 'west'),
];

export const TUNNELS: SceneDef = {
  id: 'tunnels',
  title: 'IV — The Mill Tunnels',
  subtitle: 'Headrace and tailrace, Corran Mill',
  bounds: { x: -160, y: -260, w: 3380, h: 560 },
  spawns: {
    default: { x: 60, y: G, facing: 1 },
    west: { x: 20, y: G, facing: 1 },
    ledger: { x: 720, y: G, facing: 1 },
    winch: { x: 1180, y: 72, facing: 1 },
    passage: { x: 2300, y: 72, facing: 1 },
  },
  palette: PALETTES.tunnels,
  ambience: { droneHz: 34, wind: 0.08, water: 0.8, creak: 0.6, space: 0.92 },
  colliders: [...colliders, ...beforeColliders],
  props,
  lamps: [
    ...[200, 700, 1400, 2000, 2700].map((x, i) => ({
      id: `b-tun-lamp-${i}`,
      x,
      y: i < 2 ? CEIL + 46 : CEIL + 136,
      radius: 210,
      color: 0xffbb63,
      intensity: 0.5,
      layer: 'before' as const,
      flicker: 0.1 + (i % 2) * 0.1,
    })),
  ],
  interactables,
  triggers,
  drowned: [
    // The keeper: tall, slow, patrols the lower gallery. The only Drowned that
    // genuinely corners the player, and the passage is wide enough to pass.
    {
      id: 'drowned-tunnels-keeper',
      x: 1700,
      y: 72,
      homeMin: 1120,
      homeMax: 2120,
      behaviour: 'wanderer',
      variant: 'keeper',
      speed: 96,
    },
    // Martin. He never pursues. He is facing the gatehouse, waiting.
    {
      id: 'drowned-martin',
      x: 2380,
      y: 72,
      homeMin: 2370,
      homeMax: 2390,
      behaviour: 'scripted',
      variant: 'child',
      requiresFlag: 'tunnel-beam-raised',
    },
  ],
  particles: { drips: 11, silt: 5, dust: 2 },
  lanternAvailable: true,
};
