import { PALETTES } from '@/rendering/palette';
import type { Collider } from '@/physics/types';
import type { InteractableDef, PropPlacement, SceneDef, TriggerDef } from '@/world/types';
import {
  beat,
  beforeDeck,
  beforeFloor,
  beforeSlab,
  bprop,
  brun,
  checkpoint,
  document,
  doorway,
  exitZone,
  floor,
  framing,
  look,
  crawl,
  prop,
  ramp,
  wall,
} from '@/world/build';

/**
 * CHAPTER II - Corran Mill
 *
 * Where the game becomes itself. Three beats:
 *   1. The footbridge. Teaches that lit Before geometry is load-bearing, with
 *      a soft landing if she gets it wrong.
 *   2. The first Drowned, placed in an open street with nothing behind her, so
 *      the player can experiment with the rule in safety.
 *   3. The chalk tally and the evacuation notice, which turn the mystery from
 *      "what is this place" into "what did Edith do".
 */

const G = 0;
/** Floor of the mill leat, under the broken footbridge. */
const LEAT = 148;

const colliders: Collider[] = [
  floor(-120, 1180, G),
  // The leat: a dry channel with ramps at both ends, so a fall is never fatal
  // and never a dead end.
  floor(1180, 1230, 40),
  floor(1200, 1260, 92),
  floor(1240, 1560, LEAT),
  floor(1540, 1600, 92),
  floor(1570, 1620, 40),
  floor(1600, 2980, G),
  ...ramp(2950, 3050, G, -40),
  floor(3040, 3140, -40),
  ...ramp(3130, 3230, -40, -72),
  floor(3220, 3900, -72),
  wall(-180, G, 60, 600),
  wall(3900, -72, 70, 600),
  // A low arch under the chapel steps she has to crouch through. The mass
  // hangs from above and the gap is too short to stand in.
  ...crawl(2620, 2780, G, 40, 240),
  // Keeps her from climbing out of the street.
  { kind: 'solid', layer: 'present', x: -160, y: -520, w: 4100, h: 40 },
];

const beforeColliders: Collider[] = [
  // THE FOOTBRIDGE. The whole point of the chapter: a deck that exists only
  // while the beam is on it.
  beforeSlab(1140, 1660, -2, { id: 'bridge-deck' }),
  beforeFloor(-120, 1180, -4),
  beforeFloor(1620, 2980, -4),
  beforeDeck(2960, 3900, -76),
];

const props: PropPlacement[] = [
  // --- Present-day street: ruins, both sides, tide-marked ---
  prop('hills', -300, -150, 1, { w: 2400, h: 300, ridges: 2 }),
  prop('hills', 1700, -170, 1, { w: 2600, h: 320, ridges: 2 }),
  prop('roofline', -150, -40, 2, { w: 1600, h: 220, count: 9 }),
  prop('roofline', 2000, -60, 2, { w: 1800, h: 240, count: 10 }),

  prop('facade', -120, G, 3, { w: 210, h: 260, floors: 2, cols: 3, style: 'stone', tide: 120 }),
  prop('facade', 110, G, 4, { w: 230, h: 280, floors: 2, cols: 3, style: 'house', tide: 130 }),
  prop('facade', 360, G, 4, { w: 200, h: 240, floors: 2, cols: 3, style: 'shop', tide: 110 }),
  prop('facade', 580, G, 4, { w: 250, h: 300, floors: 3, cols: 3, style: 'stone', tide: 140 }),
  prop('facade', 850, G, 4, { w: 220, h: 260, floors: 2, cols: 3, style: 'house', tide: 120 }),
  prop('rubble', 1080, G, 4, { w: 180, h: 70 }),

  // --- The leat and the ruined bridge ---
  prop('wallmass', 1140, G, 4, { w: 90, h: 180, value: 0.17, tide: 120, lift: 34 }),
  prop('wallmass', 1570, G, 4, { w: 90, h: 180, value: 0.17, tide: 120, lift: 34 }),
  prop('wallmass', 1230, LEAT, 4, { w: 330, h: 40, value: 0.12, tide: 30 }),
  prop('waterline', 1250, LEAT, 4, { w: 300, d: 28, value: 0.1 }),
  prop('rubble', 1270, LEAT, 5, { w: 160, h: 46 }),
  prop('girder', 1130, -6, 4, { w: 110, h: 22, style: 'beam' }),
  prop('girder', 1560, -6, 4, { w: 110, h: 22, style: 'beam' }),
  prop('railing', 1140, G, 5, { w: 70, h: 46, style: 'iron', broken: true }),
  prop('railing', 1560, G, 5, { w: 70, h: 46, style: 'iron', broken: true }),
  prop('weedcurtain', 1150, -6, 5, { w: 90, h: 70 }),

  // --- East side of the leat ---
  prop('facade', 1640, G, 4, { w: 240, h: 290, floors: 2, cols: 4, style: 'shop', tide: 130 }),
  prop('facade', 1900, G, 4, { w: 210, h: 250, floors: 2, cols: 3, style: 'house', tide: 120 }),
  prop('facade', 2130, G, 3, { w: 260, h: 320, floors: 3, cols: 4, style: 'mill', tide: 150 }),
  prop('facade', 2410, G, 4, { w: 200, h: 240, floors: 2, cols: 3, style: 'house', tide: 115 }),
  prop('wallmass', 2600, G, 4, { w: 200, h: 240, value: 0.16, tide: 130, lift: 40 }),
  prop('tower', 2820, G, 3, { w: 76, h: 420, style: 'bell', spireH: 110, tide: 190 }),
  prop('facade', 2920, -40, 4, { w: 230, h: 250, floors: 2, cols: 3, style: 'stone', tide: 100 }),
  prop('facade', 3180, -72, 4, { w: 250, h: 300, floors: 3, cols: 3, style: 'mill', tide: 120 }),
  prop('facade', 3460, -72, 4, { w: 220, h: 270, floors: 2, cols: 3, style: 'house', tide: 110 }),

  // --- Street furniture, dead ---
  prop('lamppost', 300, G, 5, { h: 148, lit: false }),
  prop('lamppost', 900, G, 5, { h: 148, lit: false, armFlip: true }),
  prop('lamppost', 1980, G, 5, { h: 148, lit: false }),
  prop('lamppost', 2500, G, 5, { h: 148, lit: false, armFlip: true }),
  prop('groundstrip', -120, G, 4, { w: 1300, style: 'cobble', value: 0.11 }),
  prop('groundstrip', 1600, G, 4, { w: 1380, style: 'cobble', value: 0.11 }),
  prop('silt', 400, G, 4, { w: 300, h: 30 }),
  prop('silt', 1700, G, 4, { w: 360, h: 34 }),
  prop('furniture', 760, G, 5, { style: 'crate', w: 40, h: 32 }),
  prop('rubble', 2250, G, 5, { w: 150, h: 40 }),
  prop('sign', 2330, G, 5, { w: 70, h: 90, postH: 0, lines: 4, style: 'plain' }),
  prop('doorframe', 3300, -72, 5, { w: 48, h: 86, open: false, arch: true }),

  // --- Foreground ---
  prop('rubble', 150, G + 30, 6, { w: 320, h: 90 }),
  prop('railing', 1900, G + 20, 6, { w: 300, h: 70, style: 'iron', broken: true }),
  prop('silt', 2700, G + 30, 6, { w: 500, h: 70 }),
  prop('weedcurtain', 650, -240, 6, { w: 200, h: 110 }),

  // --- 1964: the same street, alive ---
  ...brun('facade', -120, 1160, 235, G, 4, {
    w: 215, h: 275, floors: 2, cols: 3, style: 'house', roof: 'gable', tide: 0, lit: true,
  }),
  bprop('facade', 360, G, 4, { w: 200, h: 240, floors: 2, cols: 3, style: 'shop', tide: 0, lit: true }),
  // The bridge, whole.
  bprop('girder', 1140, -2, 4, { w: 520, h: 26, style: 'truss' }),
  bprop('groundstrip', 1140, -2, 4, { w: 520, style: 'boards', value: 0.3 }),
  bprop('railing', 1140, -2, 5, { w: 520, h: 48, style: 'timber' }),
  bprop('railing', 1140, -2, 3, { w: 520, h: 48, style: 'timber' }),
  ...brun('facade', 1640, 2560, 240, G, 4, {
    w: 220, h: 280, floors: 2, cols: 3, style: 'house', roof: 'gable', tide: 0, lit: true,
  }),
  bprop('facade', 2130, G, 3, { w: 260, h: 340, floors: 3, cols: 4, style: 'mill', tide: 0, lit: true }),
  bprop('tower', 2820, G, 3, { w: 76, h: 430, style: 'bell', spireH: 120, tide: 0, lit: true }),
  ...brun('facade', 2960, 3860, 250, -76, 4, {
    w: 230, h: 290, floors: 2, cols: 3, style: 'stone', roof: 'gable', tide: 0, lit: true,
  }),
  ...brun('lamppost', 300, 3600, 420, G, 5, { h: 148, lit: true }),
  bprop('groundstrip', -120, -4, 4, { w: 3900, style: 'cobble', value: 0.28 }),
  ...brun('curtain', 420, 2400, 640, -190, 4, { w: 70, h: 90, value: 0.3 }),
  bprop('roofline', -100, -270, 2, { w: 2000, h: 280, count: 11 }),
  bprop('roofline', 1900, -290, 2, { w: 2200, h: 300, count: 12 }),
  bprop('minecart', 2300, -4, 5, { w: 70, h: 44 }),
];

const interactables: InteractableDef[] = [
  look('street-shop', 420, G, 'Grocer’s window', 'street-shopwindow', { requiresLight: true }),
  document(
    'street-notice',
    2660,
    -58,
    'Parish noticeboard',
    'street-chapel',
    'clue-notice',
    { setsFlag: 'read-notice' },
  ),
  document('street-tally', 2000, G, 'Chalk marks', 'street-tally', 'clue-tally'),
  doorway('street-ward-door', 3300, -72, 'The schoolhouse', 'ward', 'west', {
    label: 'The schoolhouse',
  }),
];

const triggers: TriggerDef[] = [
  beat('street-arrive', -40, 240, 'street-arrive'),
  checkpoint('street-cp-west', 60, 'west'),
  framing('street-frame-bridge', 1390, 520, { zoom: 0.9, offsetY: 30 }),
  beat('street-bridge-beat', 1080, 200, 'street-bridge'),
  checkpoint('street-cp-bridge', 1100, 'bridge'),
  checkpoint('street-cp-east-bridge', 1680, 'eastbridge'),
  // The first Drowned. Narration fires only once she has actually lit it.
  {
    id: 'street-firstdrowned',
    zone: { x: 1700, y: -300, w: 500, h: 460 },
    kind: 'story',
    once: true,
    textId: 'street-firstdrowned',
    requiresLantern: true,
    setsFlag: 'seen-drowned',
  },
  {
    id: 'street-rule',
    zone: { x: 2050, y: -300, w: 700, h: 460 },
    kind: 'story',
    once: true,
    textId: 'street-rule',
    requiresFlag: 'seen-drowned',
    setsFlag: 'knows-rule',
    checkpointId: 'tally',
  },
  checkpoint('street-cp-tally', 2100, 'tally'),
  {
    id: 'street-edith',
    zone: { x: 2700, y: -300, w: 260, h: 460 },
    kind: 'story',
    once: true,
    textId: 'street-edith',
    requiresFlag: 'read-notice',
  },
  checkpoint('street-cp-chapel', 2980, 'chapel'),
  exitZone('street-exit-ward', 3340, 110, 'ward', 'west'),
];

export const HIGHSTREET: SceneDef = {
  id: 'highstreet',
  title: 'II — Corran Mill',
  subtitle: 'Population two hundred and six, until 11 April 1964',
  bounds: { x: -160, y: -560, w: 4080, h: 800 },
  spawns: {
    default: { x: 60, y: G, facing: 1 },
    west: { x: 20, y: G, facing: 1 },
    bridge: { x: 1100, y: G, facing: 1 },
    eastbridge: { x: 1680, y: G, facing: 1 },
    tally: { x: 2100, y: G, facing: 1 },
    chapel: { x: 2980, y: -40, facing: 1 },
  },
  palette: PALETTES.highstreet,
  ambience: { droneHz: 41, wind: 0.6, water: 0.45, creak: 0.55, space: 0.62 },
  colliders: [...colliders, ...beforeColliders],
  props,
  lamps: [
    { id: 'moon-street', x: 1400, y: -760, radius: 700, color: 0x8fb6cc, intensity: 0.22, layer: 'present' },
    { id: 'b-lamp-1', x: 346, y: -150, radius: 175, color: 0xffac52, intensity: 0.5, layer: 'before', flicker: 0.1 },
    { id: 'b-lamp-2', x: 766, y: -150, radius: 175, color: 0xffac52, intensity: 0.5, layer: 'before', flicker: 0.16 },
    { id: 'b-lamp-3', x: 1186, y: -150, radius: 175, color: 0xffac52, intensity: 0.45, layer: 'before', flicker: 0.24 },
    { id: 'b-lamp-4', x: 1606, y: -150, radius: 175, color: 0xffac52, intensity: 0.5, layer: 'before', flicker: 0.1 },
    { id: 'b-lamp-5', x: 2026, y: -150, radius: 175, color: 0xffac52, intensity: 0.5, layer: 'before' },
    { id: 'b-lamp-6', x: 2446, y: -150, radius: 175, color: 0xffac52, intensity: 0.5, layer: 'before', flicker: 0.12 },
    { id: 'b-lamp-7', x: 3286, y: -226, radius: 175, color: 0xffac52, intensity: 0.5, layer: 'before' },
    // The chapel windows, which are the warmest thing in the chapter.
    { id: 'b-chapel', x: 2858, y: -300, radius: 260, color: 0xffc070, intensity: 0.42, layer: 'before', flicker: 0.07 },
  ],
  interactables,
  triggers,
  drowned: [
    // One sentinel, in the open, on a long patrol span. Deliberately the
    // easiest encounter in the game: there is room to run in both directions.
    {
      id: 'drowned-street-1',
      x: 1860,
      y: G,
      homeMin: 1660,
      homeMax: 2320,
      behaviour: 'sentinel',
      variant: 'adult',
    },
    // A second one, behind the chapel arch, to make the crouch-through tense.
    {
      id: 'drowned-street-2',
      x: 2700,
      y: G,
      homeMin: 2420,
      homeMax: 2940,
      behaviour: 'wanderer',
      variant: 'adult',
      requiresFlag: 'knows-rule',
    },
  ],
  particles: { silt: 7, drips: 3, dust: 1 },
  lanternAvailable: true,
};
