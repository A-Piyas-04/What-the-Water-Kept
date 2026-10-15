import { PALETTES } from '@/rendering/palette';
import type { Collider } from '@/physics/types';
import type { InteractableDef, PropPlacement, SceneDef, TriggerDef } from '@/world/types';
import {
  beat,
  beforeFloor,
  bprop,
  brun,
  ceiling,
  checkpoint,
  document,
  exitZone,
  floor,
  framing,
  col,
  look,
  prop,
  ramp,
  wall,
} from '@/world/build';

/**
 * CHAPTER V - The Gatehouse
 *
 * The revelation. A single room, which is the point: after four chapters of
 * open valley and tunnels, the game closes to one desk, one window and three
 * dials, and everything the player has collected resolves here.
 *
 * The sluice dials are not a lock. They are a record. Edith set them to the
 * times in her own ledger and filed her confession where the next keeper would
 * find it - and the next keeper was a reservoir. Reproducing her settings is
 * the player performing her act, deliberately, sixty-one years late.
 */

const G = 0;
const CEIL = -230;

/** X positions of the three dials and the three clocks above them. */
export const DIAL_X: readonly number[] = [820, 1040, 1260];

const colliders: Collider[] = [
  floor(-120, 2400, G),
  ceiling(-120, 2400, CEIL),
  wall(-180, G, 60, 460),
  wall(2400, G, 70, 460),
  // The lobby steps up into the control room, so the desk reads as a dais.
  ...ramp(540, 700, G, -24),
  floor(690, 1620, -24),
  // The window embrasure is a deep reveal above head height, not a wall:
  // the walkway beneath it has to stay clear or the chapter cannot be left.
  col('solid', 1620, -24 - 210, 40, 118),
  ...ramp(1610, 1700, -24, G),
  floor(1690, 2400, G),
  // The door out to the gate, shut until she has the log.
  wall(2240, G, 30, 220, { blockedByFlag: 'has-log' }),
];

const beforeColliders: Collider[] = [
  beforeFloor(-120, 700, -4),
  beforeFloor(700, 1640, -28),
  beforeFloor(1680, 2400, -4),
];

const props: PropPlacement[] = [
  // --- The room ---
  prop('interiorwall', -120, G, 2, { w: 800, h: 300, value: 0.15, tide: 130 }),
  prop('interiorwall', 700, -24, 2, { w: 1000, h: 300, value: 0.15, tide: 120 }),
  prop('interiorwall', 1680, G, 2, { w: 800, h: 300, value: 0.15, tide: 130 }),
  prop('interiorwall', -120, G, 3, { w: 2520, h: 220, value: 0.12, dado: true, dadoH: 80, tide: 110 }),
  prop('groundstrip', -120, G, 4, { w: 820, style: 'boards', value: 0.13 }),
  prop('groundstrip', 700, -24, 4, { w: 940, style: 'boards', value: 0.14 }),
  prop('groundstrip', 1680, G, 4, { w: 720, style: 'boards', value: 0.13 }),
  prop('girder', -120, CEIL + 36, 3, { w: 2520, h: 22, style: 'beam' }),

  // --- The lobby: the key board, a bench, a stopped notice ---
  prop('furniture', 80, G, 4, { style: 'bench', w: 110, h: 40 }),
  prop('furniture', 260, G, 4, { style: 'shelf', w: 72, h: 160 }),
  prop('paper', 420, -130, 5, { w: 34, h: 44, lines: 8 }),
  prop('paper', 462, -126, 5, { w: 30, h: 38, lines: 6 }),
  prop('doorframe', 560, G, 4, { w: 62, h: 150, open: true, arch: true }),
  prop('stair', 560, G, 4, { steps: 8, rise: 14, run: 15, dir: 1, w: 1 }),

  // --- The control desk and the three dials ---
  prop('controldesk', 760, -24, 4, { w: 560, h: 58, backH: 92 }),
  ...DIAL_X.map((x) => prop('dialface', x, -176, 5, { r: 34, marks: 12 })),
  // The three stopped clocks, one above each dial. The puzzle's entire clue.
  ...DIAL_X.map((x) => prop('clockface', x, -252, 5, { r: 23, stopped: true })),
  prop('machine', 1360, -24, 4, { w: 180, h: 150 }),
  prop('piperun', 1340, -200, 4, { len: 300, r: 11, value: 0.16, brackets: false }),
  prop('valve', 1560, -150, 5, { r: 21, spokes: 5, angle: 1.1 }),
  prop('furniture', 700, -24, 5, { style: 'chair', w: 32, h: 48, toppled: true }),
  prop('furniture', 1450, -24, 4, { style: 'shelf', w: 70, h: 170 }),

  // --- The window down the valley: the chapter's one source of composition ---
  prop('windowtall', 1700, -40, 3, { w: 150, h: 200, cols: 4, rows: 5, broken: true }),
  prop('railing', 1690, -40, 5, { w: 170, h: 50, style: 'iron', broken: true }),
  prop('rubble', 1860, G, 4, { w: 200, h: 60 }),
  prop('furniture', 2080, G, 4, { style: 'crate', w: 50, h: 40 }),
  prop('doorframe', 2220, G, 4, { w: 60, h: 140, open: false }),
  prop('sign', 2140, -150, 5, { w: 76, h: 30, postH: 0, lines: 2 }),

  // --- Foreground ---
  prop('controldesk', 900, G + 60, 6, { w: 400, h: 70, backH: 40 }),
  prop('piperun', -120, G + 50, 6, { len: 700, r: 22, value: 0.04, joint: 180 }),
  prop('weedcurtain', 1600, CEIL + 60, 6, { w: 240, h: 130 }),

  // --- 1964: the gatehouse on shift, every lamp burning ---
  bprop('interiorwall', -120, -4, 3, { w: 2520, h: 230, value: 0.32, dado: true, dadoH: 82, tide: 0 }),
  bprop('groundstrip', -120, -4, 4, { w: 820, style: 'boards', value: 0.34 }),
  bprop('groundstrip', 700, -28, 4, { w: 940, style: 'boards', value: 0.34 }),
  bprop('groundstrip', 1680, -4, 4, { w: 720, style: 'boards', value: 0.34 }),
  bprop('controldesk', 760, -28, 4, { w: 560, h: 58, backH: 92 }),
  ...DIAL_X.map((x) => bprop('dialface', x, -180, 5, { r: 34, marks: 12 })),
  // In 1964 the clocks are running, and they all read the same time.
  ...DIAL_X.map((x) => bprop('clockface', x, -256, 5, { r: 23, hour: 9, minute: 38, stopped: false })),
  ...brun('hanginglamp', 300, 2300, 420, CEIL + 40, 4, { cord: 50, r: 16, lit: true }),
  bprop('windowtall', 1700, -44, 3, { w: 150, h: 200, cols: 4, rows: 5, lit: true, broken: false }),
  bprop('machine', 1360, -28, 4, { w: 180, h: 150 }),
  bprop('furniture', 1450, -28, 4, { style: 'shelf', w: 70, h: 170 }),
  bprop('furniture', 260, -4, 4, { style: 'shelf', w: 72, h: 160 }),
  bprop('furniture', 80, -4, 4, { style: 'bench', w: 110, h: 40 }),
  bprop('furniture', 700, -28, 5, { style: 'chair', w: 32, h: 48 }),
  // Her coat, on the back of the chair she left.
  bprop('curtain', 690, -80, 5, { w: 34, h: 52, value: 0.22 }),
];

const interactables: InteractableDef[] = [
  look('gate-keys', 440, -110, 'Key board', 'locked-needs-key', { requiresLight: true }),
  document(
    'gate-clocks',
    DIAL_X[1],
    -252,
    'Three stopped clocks',
    'gate-clocks',
    'clue-clocks',
    { setsFlag: 'read-clocks', requiresLight: true, zone: { x: DIAL_X[0] - 70, y: -300, w: 520, h: 130 } },
  ),
  // One interactable per dial. They are a puzzle, not a door.
  ...DIAL_X.map((x, i) => ({
    id: `gate-dial-${i}`,
    zone: { x: x - 52, y: -210, w: 104, h: 120 },
    kind: 'puzzle' as const,
    verb: 'Turn',
    label: `Sluice ${i + 1}`,
    puzzleId: 'puzzle-sluice',
    requiresFlag: 'read-clocks',
    lockedTextId: 'needs-lantern',
  })),
  {
    id: 'gate-log',
    zone: { x: 760, y: -110, w: 110, h: 110 },
    kind: 'pickup',
    verb: 'Take',
    label: 'The gate log',
    itemId: 'item-log',
    textId: 'gate-log',
    clueId: 'clue-log',
    setsFlag: 'has-log',
    requiresFlag: 'gate-log-open',
    once: true,
  },
  look('gate-window', 1760, G, 'The valley below', 'gate-arrive'),
  {
    id: 'gate-door-out',
    zone: { x: 2190, y: -140, w: 110, h: 140 },
    kind: 'door',
    verb: 'Open',
    label: 'Out to the gate',
    exitTo: 'gate' as const,
    exitSpawn: 'west',
    requiresFlag: 'has-log',
    lockedTextId: 'locked-generic',
  },
];

const triggers: TriggerDef[] = [
  beat('gatehouse-arrive', -40, 240, 'gate-arrive'),
  checkpoint('gatehouse-cp-west', 60, 'west'),
  framing('gatehouse-frame-desk', 1040, 700, { zoom: 1.05, offsetY: -46 }),
  checkpoint('gatehouse-cp-desk', 1000, 'desk'),
  {
    id: 'gatehouse-solved',
    zone: { x: 700, y: -300, w: 700, h: 460 },
    kind: 'story',
    once: true,
    textId: 'gate-solved',
    requiresFlag: 'gate-log-open',
  },
  {
    id: 'gatehouse-revelation',
    zone: { x: 1760, y: -300, w: 300, h: 460 },
    kind: 'cinematic',
    once: true,
    textId: 'gate-revelation',
    cinematicId: 'revelation',
    requiresFlag: 'has-log',
    setsFlag: 'knows-everything',
    checkpointId: 'window',
  },
  checkpoint('gatehouse-cp-window', 1800, 'window'),
  exitZone('gatehouse-exit-gate', 2300, 100, 'gate', 'west', { requiresFlag: 'has-log' }),
];

export const GATEHOUSE: SceneDef = {
  id: 'gatehouse',
  title: 'V — The Gatehouse',
  subtitle: 'Corran Valley dam, upper sluice control',
  bounds: { x: -160, y: -320, w: 2580, h: 560 },
  spawns: {
    default: { x: 60, y: G, facing: 1 },
    west: { x: 20, y: G, facing: 1 },
    desk: { x: 1000, y: -24, facing: 1 },
    window: { x: 1800, y: G, facing: 1 },
  },
  palette: PALETTES.gatehouse,
  ambience: { droneHz: 44, wind: 0.42, water: 0.4, creak: 0.5, space: 0.7 },
  colliders: [...colliders, ...beforeColliders],
  props,
  lamps: [
    // Moonlight through the broken window. It falls across the desk, which is
    // exactly where the player needs to be looking.
    { id: 'gate-moon', x: 1740, y: -140, radius: 420, color: 0x8fb4cc, intensity: 0.34, layer: 'present' },
    { id: 'gate-moon-2', x: 1500, y: -60, radius: 280, color: 0x8fb4cc, intensity: 0.18, layer: 'present' },
    ...[300, 720, 1140, 1560, 1980, 2300].map((x, i) => ({
      id: `b-gh-lamp-${i}`,
      x,
      y: CEIL + 56,
      radius: 220,
      color: 0xffba62,
      intensity: 0.5,
      layer: 'before' as const,
      flicker: 0.06 + (i % 3) * 0.04,
    })),
  ],
  interactables,
  triggers,
  drowned: [],
  particles: { silt: 6, dust: 4, drips: 3 },
  lanternAvailable: true,
};
