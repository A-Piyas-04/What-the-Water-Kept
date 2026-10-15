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
  col,
  floor,
  framing,
  prop,
  ramp,
  wall,
} from '@/world/build';

/**
 * CHAPTER VI - The Drowning Gate
 *
 * The finale. They are refilling the reservoir on schedule and nobody told the
 * surveyor still in the valley. The water comes up the whole chapter.
 *
 * Martin is in the gate mouth, where he has stood for sixty-one years, facing
 * the gatehouse, waiting for his sister to come out. Wren has her confession
 * in her hand with his name on the back of it.
 *
 * The ending is one deliberate action, and it is the exact inverse of every
 * other encounter in the game: lighting one of the Drowned has been lethal for
 * five chapters, and here it is the only kind thing left to do. The player can
 * also simply walk past him in the dark, which is safe, and which is the
 * colder ending.
 */

const G = 0;

const colliders: Collider[] = [
  // The tailrace apron below the gate, climbing eastward to the valley side.
  floor(0, 900, G),
  ...ramp(880, 1000, G, -34),
  floor(990, 1700, -34),
  ...ramp(1690, 1790, -34, -62),
  floor(1780, 1860, -62),
  ...ramp(1850, 1960, -62, -96),
  floor(1950, 2040, -96),
  ...ramp(2030, 2150, -96, -130),
  floor(2140, 2600, -130),
  wall(-180, G, 60, 700),
  // The gate structure itself, filling the west of the frame.
  wall(-120, G, 120, 420),
  // The gate mouth where Martin stands: a recess under the great gate. It is
  // level with the apron, so she can walk straight out of it.
  floor(120, 460, G),
  // The catwalk she arrives on from the gatehouse door: a thin steel walkway,
  // not a block of concrete. It has to be thin, or the ladder that descends
  // from its east end is buried inside it and there is no way down at all.
  col('solid', 10, -300, 180, 14),
  // The ladder from the catwalk's east end into the gate mouth.
  { kind: 'ladder', layer: 'present', x: 156, y: -300, w: 34, h: 318 },
  // The valley side she escapes over.
  wall(2600, -130, 70, 700),
];

const beforeColliders: Collider[] = [
  beforeFloor(-120, 900, -4),
  beforeDeck(880, 1060, -38),
  beforeDeck(1020, 1720, -66),
  beforeDeck(1680, 1860, -100),
  beforeDeck(1820, 2600, -134),
];

const props: PropPlacement[] = [
  // --- The gate, enormous, west ---
  prop('wallmass', -600, G, 2, { w: 700, h: 780, value: 0.18, batter: 70, lift: 52, tide: 240 }),
  prop('sluicegate', -40, G, 3, { w: 240, h: 340, lift: 0 }),
  prop('wallmass', 200, G, 3, { w: 160, h: 600, value: 0.17, lift: 50, tide: 200 }),
  prop('girder', 10, -300, 4, { w: 180, h: 26, style: 'truss' }),
  prop('groundstrip', 10, -300, 4, { w: 180, style: 'grating', value: 0.17 }),
  prop('railing', 10, -300, 5, { w: 150, h: 48, style: 'iron' }),
  prop('railing', 10, -300, 3, { w: 180, h: 48, style: 'iron' }),
  prop('tower', 300, -600, 3, { w: 70, h: 180, style: 'intake', tide: 0 }),

  // --- The valley opening out east: this is the widest shot in the game ---
  prop('hills', 400, -260, 1, { w: 2600, h: 320, ridges: 3 }),
  prop('silt', 400, G, 2, { w: 1400, h: 200 }),
  prop('silt', 1600, -130, 2, { w: 1200, h: 170 }),
  prop('roofline', 700, -62, 3, { w: 900, h: 160, count: 7, windows: false }),
  prop('tower', 1500, -62, 3, { w: 50, h: 210, style: 'bell', spireH: 56, tide: 130 }),

  // --- The apron ---
  prop('groundstrip', 480, G, 4, { w: 460, style: 'cobble', value: 0.12 }),
  prop('silt', 500, G, 4, { w: 420, h: 48 }),
  prop('rubble', 900, -34, 4, { w: 180, h: 60 }),
  prop('stair', 880, G, 4, { steps: 3, rise: 11, run: 40, dir: 1, w: 1 }),

  prop('deadtree', 1200, -62, 4, { h: 220, thick: 12, lean: 0.2, depth: 4 }),
  prop('deadtree', 1420, -62, 5, { h: 170, thick: 9, lean: -0.26, depth: 4 }),
  prop('fenceline', 1100, -62, 4, { w: 280, h: 40 }),
  prop('stair', 1690, -34, 4, { steps: 3, rise: 10, run: 33, dir: 1, w: 1 }),
  prop('stair', 1850, -62, 4, { steps: 3, rise: 12, run: 36, dir: 1, w: 1 }),
  prop('silt', 1900, -130, 4, { w: 700, h: 70 }),
  prop('sign', 2380, -130, 5, { w: 92, h: 36, postH: 60, lines: 3 }),
  prop('boatwreck', 700, G, 5, { w: 150, h: 44 }),
  prop('piperun', 360, -120, 4, { len: 520, r: 15, value: 0.16 }),

  // --- Foreground ---
  prop('silt', 300, G + 40, 6, { w: 800, h: 90 }),
  prop('reeds', 1300, -62 + 26, 6, { w: 320, h: 90, count: 44 }),
  prop('deadtree', 2100, -130 + 30, 6, { h: 300, thick: 17, lean: -0.12, depth: 3, value: 0.04 }),

  // --- 1964: the gate crew's valley, lit, and the low town still standing ---
  bprop('wallmass', -600, -4, 3, { w: 700, h: 780, value: 0.3, batter: 70, lift: 52, tide: 0 }),
  bprop('sluicegate', -40, -4, 3, { w: 240, h: 340, lift: 0 }),
  bprop('groundstrip', 120, -4, 4, { w: 780, style: 'cobble', value: 0.28 }),
  ...brun('facade', 520, 1700, 230, -4, 4, {
    w: 210, h: 250, floors: 2, cols: 3, style: 'house', roof: 'gable', tide: 0, lit: true,
  }),
  bprop('tower', 1500, -4, 3, { w: 52, h: 230, style: 'bell', spireH: 70, tide: 0, lit: true }),
  ...brun('lamppost', 300, 2400, 420, -4, 5, { h: 150, lit: true }),
  bprop('roofline', 500, -250, 2, { w: 2000, h: 280, count: 11 }),
  bprop('railing', 10, -304, 5, { w: 150, h: 48, style: 'iron' }),
];

const interactables: InteractableDef[] = [
  // THE ENDING. Two ways to take it, and the game does not label either as
  // correct - the prompt simply says what she would be doing.
  {
    id: 'gate-show-martin',
    zone: { x: 230, y: -120, w: 180, h: 120 },
    kind: 'puzzle',
    verb: 'Show him',
    label: 'The boy in the gate mouth',
    puzzleId: 'ending-shown',
    requiresLight: true,
    requiresItem: 'item-log',
    lockedTextId: 'needs-lantern',
    once: true,
  },
];

const triggers: TriggerDef[] = [
  beat('finale-arrive', 70, 200, 'finale-arrive'),
  checkpoint('gate-cp-west', 80, 'west'),
  framing('gate-frame-catwalk', 110, 300, { zoom: 0.84, offsetY: -30 }),
  framing('gate-frame-mouth', 300, 420, { zoom: 1.0, offsetY: -20 }),
  {
    id: 'finale-martin-beat',
    zone: { x: 300, y: -200, w: 300, h: 300 },
    kind: 'story',
    once: true,
    textId: 'finale-martin',
    setsFlag: 'seen-martin-gate',
  },
  checkpoint('gate-cp-mouth', 320, 'mouth'),
  framing('gate-frame-valley', 1400, 1600, { zoom: 0.8, offsetY: -50 }),
  checkpoint('gate-cp-apron', 1000, 'apron'),
  // Leaving the valley eastward ends the game, with whichever ending applies.
  {
    id: 'gate-exit-ending',
    zone: { x: 2480, y: -400, w: 160, h: 500 },
    kind: 'cinematic',
    once: true,
    cinematicId: 'ending',
    setsFlag: 'reached-ending',
  },
];

export const GATE: SceneDef = {
  id: 'gate',
  title: 'VI — The Drowning Gate',
  subtitle: 'Upper sluice, reopening on schedule',
  bounds: { x: -160, y: -680, w: 2800, h: 940 },
  spawns: {
    default: { x: 70, y: -300, facing: 1 },
    west: { x: 70, y: -300, facing: 1 },
    mouth: { x: 320, y: G, facing: -1 },
    apron: { x: 1000, y: -34, facing: 1 },
  },
  palette: PALETTES.gate,
  ambience: { droneHz: 52, wind: 0.9, water: 0.95, creak: 0.4, space: 0.8 },
  colliders: [...colliders, ...beforeColliders],
  props,
  lamps: [
    { id: 'gate-flood-1', x: 100, y: -560, radius: 520, color: 0xa8c8dc, intensity: 0.42, layer: 'present', flicker: 0.04 },
    { id: 'gate-flood-2', x: 500, y: -620, radius: 460, color: 0xa8c8dc, intensity: 0.3, layer: 'present' },
    ...[300, 720, 1140, 1560, 1980].map((x, i) => ({
      id: `b-gate-lamp-${i}`,
      x,
      y: -154,
      radius: 190,
      color: 0xffad5a,
      intensity: 0.5,
      layer: 'before' as const,
      flicker: 0.1,
    })),
  ],
  interactables,
  triggers,
  drowned: [
    // Martin, and only Martin. No threat in the final chapter: the tension is
    // the water and the decision, and adding a chase here would cheapen both.
    {
      id: 'drowned-martin-gate',
      x: 300,
      y: G,
      homeMin: 296,
      homeMax: 304,
      behaviour: 'scripted',
      variant: 'child',
    },
  ],
  particles: { silt: 9, dust: 3, drips: 5 },
  lanternAvailable: true,
  introCinematic: 'finale-start',
};
