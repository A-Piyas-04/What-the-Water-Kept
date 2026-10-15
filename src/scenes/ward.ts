import { PALETTES } from '@/rendering/palette';
import type { Collider } from '@/physics/types';
import type { InteractableDef, PropPlacement, SceneDef, TriggerDef } from '@/world/types';
import { WARD_FLOOR } from '@/puzzles/chalk';
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
  look,
  crawl,
  prop,
  ramp,
  wall,
} from '@/world/build';

/**
 * CHAPTER III - The Sunken Ward
 *
 * The horror set-piece. The schoolhouse took the low town's infirmary beds
 * when the water came up, and nineteen voices are still holding one note in
 * it.
 *
 * The design problem: a chase in a corridor is a fail-state generator, not
 * horror. So this chapter is a *reading* challenge. The children chalked the
 * floor - a closed mouth where it is safe to be lit, a cross where it is not -
 * and the player crosses the ward by reading it. The chalk is only visible
 * inside the beam, so she has to light the floor she is about to risk.
 *
 * Every section is passable with the lamp off. A player who panics and runs
 * blind still gets through. The puzzle is about trust, not about gating.
 */

const G = 0;
const CEIL = -210;
/** The ward's chalked floor runs from here, in seven equal sections. */
export const WARD_START = 620;
export const WARD_SECTION = 232;

const sectionX = (i: number): number => WARD_START + WARD_SECTION * (i + 0.5);

const colliders: Collider[] = [
  floor(-120, 2900, G),
  ceiling(-120, 2900, CEIL),
  wall(-180, G, 60, 400),
  wall(2900, G, 70, 400),
  // The entrance lobby, separated from the ward by a low collapsed doorway
  // she has to crouch through - which is also where she first sees the chalk.
  ...crawl(520, 620, G, 42, 210),
  // Fallen roof timbers partway along, forcing a crouch mid-ward.
  ...crawl(1480, 1620, G, 42, 210),
  // The stair down to the tunnels, gated on crossing the ward.
  ...ramp(2410, 2520, G, -46),
  floor(2510, 2620, -46),
  ...ramp(2610, 2720, -46, -92),
  floor(2710, 2900, -92),
  // A collapsed press blocks the stair until the ward has been crossed, so the
  // chapter cannot be skipped by simply sprinting the length of it in the dark
  // without ever reading the floor.
  wall(2400, G, 26, 200, { blockedByFlag: 'ward-crossed' }),
];

const beforeColliders: Collider[] = [
  beforeFloor(-120, 2400, -4),
  beforeDeck(2400, 2620, -50),
  beforeDeck(2560, 2900, -96),
];

const props: PropPlacement[] = [
  // --- The room itself ---
  prop('interiorwall', -120, G, 2, { w: 1600, h: 300, value: 0.14, tide: 150 }),
  prop('interiorwall', 1480, G, 2, { w: 1500, h: 300, value: 0.14, tide: 150 }),
  prop('interiorwall', -120, G, 3, { w: 3000, h: 220, value: 0.11, dado: true, dadoH: 76, tide: 120 }),
  prop('groundstrip', -120, G, 4, { w: 3000, style: 'boards', value: 0.12 }),
  prop('girder', -120, CEIL + 40, 3, { w: 3000, h: 20, style: 'beam' }),
  prop('girder', 300, CEIL + 70, 4, { w: 280, h: 18, style: 'beam' }),
  prop('girder', 1440, CEIL + 54, 4, { w: 220, h: 18, style: 'beam' }),

  // --- Windows, high up, letting in almost nothing ---
  prop('windowtall', 240, -120, 3, { w: 58, h: 130, cols: 2, rows: 4, broken: true }),
  prop('windowtall', 900, -120, 3, { w: 58, h: 130, cols: 2, rows: 4, broken: true }),
  prop('windowtall', 1800, -120, 3, { w: 58, h: 130, cols: 2, rows: 4, broken: true }),
  prop('windowtall', 2200, -120, 3, { w: 58, h: 130, cols: 2, rows: 4, broken: true }),

  // --- The lobby: coats, the chalkboard that teaches the glyphs ---
  prop('furniture', 60, G, 4, { style: 'shelf', w: 70, h: 150 }),
  prop('chalkboard', 220, -96, 4, { w: 170, h: 96 }),
  prop('chalkglyph', 262, -148, 5, { s: 16, glyph: 'hush', alpha: 0.8 }),
  prop('chalkglyph', 332, -148, 5, { s: 16, glyph: 'cross', alpha: 0.8 }),
  prop('furniture', 410, G, 4, { style: 'desk', w: 56, h: 40 }),
  prop('furniture', 470, G, 4, { style: 'chair', w: 30, h: 46, toppled: true }),
  prop('doorframe', 540, G, 4, { w: 60, h: 124, open: true, arch: true }),
  prop('rubble', 516, -42, 4, { w: 112, h: 44 }),

  // --- The ward: two rows of iron cots, silted to the rails ---
  ...[700, 880, 1060, 1240, 1760, 1940, 2120, 2300].flatMap((x, i) => [
    prop('furniture', x, G, 4, { style: 'bed', w: 92, h: 46, toppled: i === 3 || i === 6 }),
  ]),
  ...[780, 960, 1140, 1840, 2020, 2200].map((x) =>
    prop('furniture', x, G, 3, { style: 'bed', w: 86, h: 42 }),
  ),
  prop('curtain', 1320, -150, 5, { w: 76, h: 150, value: 0.13 }),
  prop('curtain', 1680, -150, 5, { w: 76, h: 150, value: 0.13 }),
  prop('rubble', 1476, -42, 4, { w: 152, h: 46 }),
  prop('furniture', 2340, G, 4, { style: 'shelf', w: 64, h: 140 }),
  prop('furniture', 1420, G, 4, { style: 'table', w: 70, h: 44 }),

  // --- The chalk on the floor. Gameplay, so drawn with full clarity ---
  ...WARD_FLOOR.map((glyph, i) =>
    prop('chalkglyph', sectionX(i), -16, 5, {
      s: glyph === 'hush' ? 22 : 19,
      glyph: glyph === 'hush' ? 'hush' : 'cross',
      alpha: 0.5,
    }),
  ),
  // A second, smaller hand repeating the same marks further along the boards.
  ...WARD_FLOOR.map((glyph, i) =>
    prop('chalkglyph', sectionX(i) + 70, -14, 5, {
      s: 13,
      glyph: glyph === 'hush' ? 'hush' : 'cross',
      alpha: 0.3,
    }),
  ),

  // --- The stair out ---
  prop('stair', 2420, G, 4, { steps: 4, rise: 12, run: 24, dir: 1, w: 1 }),
  prop('stair', 2560, -46, 4, { steps: 4, rise: 12, run: 22, dir: 1, w: 1 }),
  prop('doorframe', 2760, -92, 4, { w: 54, h: 104, open: true }),
  prop('rubble', 2390, G, 5, { w: 90, h: 120 }),

  // --- Foreground: cot ends and a hanging sheet, framing the composition ---
  prop('furniture', 400, G + 26, 6, { style: 'bed', w: 110, h: 60 }),
  prop('curtain', 1500, -190, 6, { w: 110, h: 190, value: 0.08 }),
  prop('furniture', 2000, G + 30, 6, { style: 'bed', w: 120, h: 64 }),

  // --- 1964: a schoolroom, lit, with thirty-one coats on the hooks ---
  bprop('interiorwall', -120, -4, 3, { w: 3000, h: 230, value: 0.3, dado: true, dadoH: 78, tide: 0 }),
  bprop('groundstrip', -120, -4, 4, { w: 3000, style: 'boards', value: 0.34 }),
  ...brun('furniture', 700, 2400, 180, -4, 4, { style: 'desk', w: 90, h: 46 }),
  ...brun('furniture', 790, 2300, 180, -4, 3, { style: 'desk', w: 84, h: 42 }),
  bprop('chalkboard', 220, -100, 4, { w: 180, h: 100 }),
  ...brun('hanginglamp', 400, 2400, 400, -210, 4, { cord: 56, r: 15, lit: true }),
  ...brun('windowtall', 240, 2400, 660, -124, 3, { w: 58, h: 130, cols: 2, rows: 4, lit: true, broken: false }),
  bprop('furniture', 60, -4, 4, { style: 'shelf', w: 70, h: 150 }),
  bprop('furniture', 2340, -4, 4, { style: 'shelf', w: 64, h: 140 }),
  ...brun('curtain', 300, 2500, 540, -60, 5, { w: 40, h: 56, value: 0.26 }),
  bprop('stair', 2400, -50, 4, { steps: 5, rise: 11, run: 22, dir: 1 }),
];

const interactables: InteractableDef[] = [
  look('ward-board', 276, -96, 'Chalkboard', 'ward-chalk', { clueId: 'clue-chalk' }),
  document(
    'ward-register',
    420,
    G,
    'School register',
    'ward-register',
    'clue-register',
    { setsFlag: 'read-register', requiresLight: true },
  ),
  look('ward-coat', 1420, G, 'A child’s coat', 'ward-coat', {
    clueId: 'clue-martin',
    requiresLight: true,
    setsFlag: 'found-coat',
  }),
  look('ward-beds', 1060, G, 'The cots', 'ward-arrive'),
];

const triggers: TriggerDef[] = [
  beat('ward-arrive', -40, 240, 'ward-arrive'),
  checkpoint('ward-cp-lobby', 120, 'west'),
  framing('ward-frame-lobby', 260, 420, { zoom: 1.08 }),
  beat('ward-chalk-beat', 560, 160, 'ward-chalk'),
  checkpoint('ward-cp-door', 668, 'door'),
  // The choir starts the moment she is inside the ward proper.
  {
    id: 'ward-choir',
    zone: { x: WARD_START, y: -300, w: 200, h: 460 },
    kind: 'scare',
    once: true,
    textId: 'ward-choir',
    cinematicId: 'choir-start',
    setsFlag: 'choir-woken',
  },
  framing('ward-frame-ward', 1500, 1900, { zoom: 0.94 }),
  {
    id: 'ward-martin-beat',
    zone: { x: 1420, y: -300, w: 200, h: 460 },
    kind: 'story',
    once: true,
    textId: 'ward-m-calloway',
    requiresFlag: 'found-coat',
  },
  checkpoint('ward-cp-mid', 1440, 'mid'),
  checkpoint('ward-cp-east', 2320, 'east'),
  exitZone('ward-exit-tunnels', 2800, 110, 'tunnels', 'west'),
];

export const WARD: SceneDef = {
  id: 'ward',
  title: 'III — The Sunken Ward',
  subtitle: 'Corran Mill schoolhouse, requisitioned 11 April 1964',
  bounds: { x: -160, y: -300, w: 3080, h: 520 },
  spawns: {
    default: { x: 60, y: G, facing: 1 },
    west: { x: 20, y: G, facing: 1 },
    door: { x: 668, y: G, facing: 1 },
    mid: { x: 1440, y: G, facing: 1 },
    east: { x: 2320, y: G, facing: 1 },
  },
  palette: PALETTES.ward,
  ambience: { droneHz: 38, wind: 0.14, water: 0.6, creak: 0.8, space: 0.86 },
  colliders: [...colliders, ...beforeColliders],
  props,
  lamps: [
    // Almost nothing. Two shafts of moonlight through the high windows, and
    // that is the entire present-day lighting budget for the chapter.
    { id: 'ward-shaft-1', x: 269, y: -170, radius: 150, color: 0x7fa8b8, intensity: 0.16, layer: 'present' },
    { id: 'ward-shaft-2', x: 1829, y: -170, radius: 150, color: 0x7fa8b8, intensity: 0.14, layer: 'present' },
    ...[400, 800, 1200, 1600, 2000, 2400].map((x, i) => ({
      id: `b-ward-lamp-${i}`,
      x,
      y: -196,
      radius: 190,
      color: 0xffbf78,
      intensity: 0.46,
      layer: 'before' as const,
      flicker: 0.08 + (i % 3) * 0.05,
    })),
  ],
  interactables,
  triggers,
  drowned: [
    // The choir. Each one stands on a cross section, which is what makes the
    // chalk worth reading: the marks are a map of where they are standing.
    {
      id: 'drowned-ward-1',
      x: sectionX(1),
      y: G,
      homeMin: WARD_START + WARD_SECTION * 0.6,
      homeMax: WARD_START + WARD_SECTION * 2.4,
      behaviour: 'choir',
      variant: 'adult',
    },
    {
      id: 'drowned-ward-2',
      x: sectionX(3),
      y: G,
      homeMin: WARD_START + WARD_SECTION * 2.7,
      homeMax: WARD_START + WARD_SECTION * 4.4,
      behaviour: 'choir',
      variant: 'adult',
    },
    {
      id: 'drowned-ward-3',
      x: sectionX(4) + 60,
      y: G,
      homeMin: WARD_START + WARD_SECTION * 3.6,
      homeMax: WARD_START + WARD_SECTION * 5.4,
      behaviour: 'choir',
      variant: 'child',
    },
  ],
  particles: { drips: 7, silt: 4 },
  lanternAvailable: true,
  introCinematic: 'ward-enter',
};
