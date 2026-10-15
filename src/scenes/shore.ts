import { PALETTES } from '@/rendering/palette';
import type { Collider } from '@/physics/types';
import type { InteractableDef, PropPlacement, SceneDef, TriggerDef } from '@/world/types';
import {
  beat,
  beforeDeck,
  beforeFloor,
  bprop,
  brun,
  checkpoint,
  document,
  exitZone,
  floor,
  framing,
  look,
  pickup,
  prop,
  ramp,
  wall,
} from '@/world/build';

/**
 * CHAPTER I - The Drained Shore
 *
 * Teaching scene. Three things, in order, with nothing else competing:
 *   1. She walks. (Open ground, one direction, a huge dam face behind her
 *      doing all the work of establishing scale and dread.)
 *   2. She finds the lantern. (One object, lit by the only warm thing on
 *      screen, at the foot of the intake tower.)
 *   3. She turns it on, and the reservoir bed becomes a street.
 *
 * There is no threat in this chapter at all. The player needs to trust the
 * lantern completely before the game makes it dangerous.
 */

const GROUND = 0;

const colliders: Collider[] = [
  // The access ramp down from the dam crest, then the reservoir bed.
  floor(-200, 180, -120),
  floor(120, 320, -80),
  floor(260, 520, -40),
  floor(460, 3500, GROUND),
  // Dam face: an impassable wall at her back.
  wall(-260, GROUND, 60, 700),
  // Silt banks she can walk over. Every height change is a ramp, so the
  // reservoir bed is continuously walkable from the dam to the east lane.
  ...ramp(1150, 1250, GROUND, -26),
  floor(1240, 1380, -26),
  ...ramp(1370, 1450, -26, -52),
  floor(1440, 1520, -52),
  ...ramp(1510, 1600, -52, -26),
  floor(1590, 1700, -26),
  ...ramp(1690, 1780, -26, GROUND),
  // The intake tower plinth, where the lamp is.
  ...ramp(2110, 2200, GROUND, -34),
  floor(2190, 2380, -34),
  ...ramp(2370, 2450, -34, GROUND),
  // Rising ground toward the drowned lane east.
  ...ramp(2860, 2960, GROUND, -30),
  floor(2950, 3060, -30),
  ...ramp(3050, 3160, -30, -64),
  floor(3150, 3500, -64),
  // The valley sides.
  wall(3500, -64, 80, 700),
];

const props: PropPlacement[] = [
  // --- The dam, filling the whole left of the frame ---
  prop('wallmass', -600, -60, 2, { w: 900, h: 760, value: 0.19, batter: 90, lift: 54, tide: 300 }),
  prop('wallmass', -620, -120, 3, { w: 520, h: 820, value: 0.15, batter: 60, tide: 260 }),
  prop('railing', -560, -860, 3, { w: 520, h: 42, style: 'iron' }),
  prop('tower', 220, -860, 3, { w: 70, h: 120, style: 'intake', tide: 0 }),

  // --- Far valley sides ---
  prop('hills', -400, -300, 1, { w: 1700, h: 300, ridges: 3 }),
  prop('hills', 1300, -330, 1, { w: 2100, h: 330, ridges: 3 }),
  prop('silt', -200, 0, 2, { w: 900, h: 150 }),
  prop('silt', 900, 0, 2, { w: 1200, h: 190 }),
  prop('silt', 2200, 0, 2, { w: 1400, h: 160 }),

  // --- The valley floor, in silhouette, with the village still under it ---
  prop('roofline', 700, -40, 3, { w: 900, h: 150, count: 7, windows: false }),
  prop('tower', 1700, -40, 3, { w: 54, h: 230, style: 'bell', spireH: 60, tide: 150 }),

  // --- Mid-ground silt and debris ---
  prop('silt', 300, GROUND, 4, { w: 520, h: 54 }),
  prop('silt', 1150, -26, 4, { w: 500, h: 72 }),
  prop('silt', 1900, GROUND, 4, { w: 620, h: 46 }),
  prop('silt', 2600, GROUND, 4, { w: 700, h: 62 }),
  prop('groundstrip', 460, GROUND, 4, { w: 2440, style: 'cobble', value: 0.1 }),

  // --- The survey camp ---
  prop('tent', 560, GROUND, 4, { w: 104, h: 68 }),
  prop('tripod', 700, GROUND, 4, { h: 96 }),
  prop('furniture', 640, GROUND, 4, { style: 'crate', w: 44, h: 34 }),
  prop('furniture', 690, GROUND, 4, { style: 'crate', w: 32, h: 26 }),
  prop('smallobject', 740, GROUND, 4, { style: 'cup', s: 1 }),
  prop('sign', 200, -80, 4, { w: 92, h: 36, postH: 58, lines: 3 }),

  // --- Wreckage along the bed ---
  prop('boatwreck', 980, GROUND, 4, { w: 180, h: 52 }),
  prop('deadtree', 1260, -26, 4, { h: 200, thick: 11, lean: 0.22, depth: 4 }),
  prop('deadtree', 1340, -52, 3, { h: 150, thick: 8, lean: -0.3, depth: 4 }),
  prop('deadtree', 1560, -26, 4, { h: 230, thick: 13, lean: 0.1, depth: 4 }),
  prop('fenceline', 1640, GROUND, 4, { w: 260, h: 40 }),
  prop('reeds', 1700, GROUND, 5, { w: 180, h: 50 }),
  prop('waterline', 1960, GROUND, 4, { w: 420, d: 34, value: 0.11 }),
  prop('reeds', 1980, GROUND, 5, { w: 240, h: 44 }),
  prop('rubble', 2400, GROUND, 4, { w: 200, h: 54 }),
  prop('smallobject', 2120, GROUND, 4, { style: 'shoe', s: 1.1 }),

  // --- The intake tower, where the lamp is ---
  prop('wallmass', 2180, -34, 4, { w: 180, h: 46, value: 0.2, lift: 30 }),
  prop('tower', 2210, -34, 4, { w: 66, h: 300, style: 'intake', tide: 110 }),
  prop('surveylamp', 2300, -34, 5, { h: 56 }),
  prop('piperun', 2360, -34, 4, { len: 420, r: 13, value: 0.17 }),

  // --- Foreground framing ---
  prop('deadtree', 380, GROUND + 30, 6, { h: 300, thick: 16, lean: -0.15, depth: 3, value: 0.04 }),
  prop('reeds', 1480, GROUND + 24, 6, { w: 300, h: 90, count: 40 }),
  prop('silt', 2750, GROUND + 34, 6, { w: 700, h: 80 }),
  prop('rubble', 900, GROUND + 26, 6, { w: 280, h: 70 }),

  // --- 1964, waiting inside the beam ---
  // The reservoir bed was a lane running down to the mill leat. Everything
  // here is placed so that the first sweep of the lamp lands on a street.
  ...brun('facade', 480, 1700, 210, GROUND, 4, {
    w: 190, h: 210, floors: 2, cols: 3, style: 'house', roof: 'gable', tide: 0, lit: true,
  }),
  bprop('facade', 1760, GROUND, 4, {
    w: 240, h: 250, floors: 2, cols: 4, style: 'shop', roof: 'gable', tide: 0, lit: true,
  }),
  bprop('tower', 1700, GROUND, 3, { w: 56, h: 300, style: 'bell', spireH: 86, tide: 0, lit: true }),
  ...brun('lamppost', 620, 2400, 400, GROUND, 5, { h: 150, lit: true }),
  bprop('groundstrip', 460, GROUND, 4, { w: 2000, style: 'cobble', value: 0.26 }),
  ...brun('facade', 2000, 2900, 230, GROUND, 4, {
    w: 210, h: 230, floors: 2, cols: 3, style: 'house', roof: 'gable', tide: 0, lit: true,
  }),
  bprop('railing', 1200, GROUND, 5, { w: 240, h: 44, style: 'iron' }),
  bprop('roofline', 500, -210, 2, { w: 1600, h: 240, count: 10 }),
  bprop('roofline', 2100, -230, 2, { w: 1400, h: 260, count: 8 }),
  // A dry lane up to the east gate, which is how she leaves.
  bprop('stair', 2960, -30, 4, { steps: 6, rise: 12, run: 22, dir: 1 }),
];

/**
 * Before-layer geometry.
 *
 * In this chapter it is generous and forgiving: the 1964 pavement is simply a
 * smoother version of the silt she is already standing on. The player should
 * discover that lit ground is solid without ever being in danger of falling.
 */
const beforeColliders: Collider[] = [
  beforeFloor(460, 2900, -6),
  beforeDeck(2900, 3060, -36),
  beforeDeck(3020, 3460, -70),
];

const interactables: InteractableDef[] = [
  look('shore-sign', 200, -80, 'Reservoir notice', 'shore-sign'),
  look('shore-tent', 575, GROUND, 'Collapsed survey tent', 'shore-camp'),
  document(
    'shore-fieldbook',
    645,
    GROUND,
    'Field book, 1964',
    'shore-fieldbook',
    'clue-fieldbook',
  ),
  look('shore-boat', 1060, GROUND, 'Overturned boat', 'shore-boat'),
  pickup(
    'shore-lantern',
    2300,
    -34,
    'Survey lantern',
    'item-lantern',
    'shore-lantern',
    { clueId: 'clue-lantern', setsFlag: 'has-lantern' },
  ),
];

const triggers: TriggerDef[] = [
  beat('shore-intro', -40, 320, 'intro-1'),
  checkpoint('shore-cp-camp', 600, 'camp'),
  framing('shore-frame-dam', 100, 700, { zoom: 0.86, offsetY: -40 }),
  framing('shore-frame-tower', 2260, 420, { zoom: 0.92, offsetY: -60 }),
  checkpoint('shore-cp-tower', 2280, 'tower'),
  // Fires the first time she switches the lamp on, anywhere in the chapter.
  {
    id: 'shore-first-light',
    zone: { x: 400, y: -400, w: 3100, h: 600 },
    kind: 'story',
    once: true,
    textId: 'shore-first-light',
    requiresLantern: true,
    setsFlag: 'seen-first-light',
  },
  checkpoint('shore-cp-east', 3080, 'east'),
  exitZone('shore-exit-east', 3420, 120, 'highstreet', 'west', {
    requiresFlag: 'has-lantern',
  }),
];

export const SHORE: SceneDef = {
  id: 'shore',
  title: 'I — The Drained Shore',
  subtitle: 'Corran Valley Reservoir, drawn down for inspection',
  bounds: { x: -240, y: -620, w: 3760, h: 860 },
  spawns: {
    default: { x: -60, y: -120, facing: 1 },
    camp: { x: 600, y: GROUND, facing: 1 },
    tower: { x: 2240, y: -34, facing: 1 },
    east: { x: 3080, y: -64, facing: 1 },
  },
  palette: PALETTES.shore,
  ambience: { droneHz: 46, wind: 0.85, water: 0.3, creak: 0.3, space: 0.72 },
  colliders: [...colliders, ...beforeColliders],
  props,
  lamps: [
    // The inspection floodlights, far up on the dam crest. The only present-day
    // light in the game that is not hers.
    { id: 'crest-flood', x: -300, y: -820, radius: 540, color: 0x9fc4d8, intensity: 0.4, layer: 'present', flicker: 0.05 },
    { id: 'crest-flood-2', x: 160, y: -880, radius: 420, color: 0x9fc4d8, intensity: 0.3, layer: 'present' },
    // 1964's street lighting. Only visible inside the beam.
    { id: 'before-lamp-1', x: 646, y: -150, radius: 180, color: 0xffb059, intensity: 0.5, layer: 'before', flicker: 0.12 },
    { id: 'before-lamp-2', x: 1046, y: -150, radius: 180, color: 0xffb059, intensity: 0.5, layer: 'before', flicker: 0.1 },
    { id: 'before-lamp-3', x: 1846, y: -150, radius: 180, color: 0xffb059, intensity: 0.5, layer: 'before', flicker: 0.18 },
    { id: 'before-lamp-4', x: 2246, y: -150, radius: 180, color: 0xffb059, intensity: 0.5, layer: 'before' },
  ],
  interactables,
  triggers,
  drowned: [],
  particles: { silt: 11, dust: 2 },
  lanternAvailable: true,
};
