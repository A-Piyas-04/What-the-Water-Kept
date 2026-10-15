import { clamp01, lerp } from '@/core/math';
import type { ScenePalette } from '@/world/types';

export const rgb = (color: number): [number, number, number] => [
  (color >> 16) & 0xff,
  (color >> 8) & 0xff,
  color & 0xff,
];

export const pack = (r: number, g: number, b: number): number =>
  ((Math.round(clamp01(r / 255) * 255) << 16) |
    (Math.round(clamp01(g / 255) * 255) << 8) |
    Math.round(clamp01(b / 255) * 255)) >>>
  0;

export const mix = (a: number, b: number, t: number): number => {
  const [ar, ag, ab] = rgb(a);
  const [br, bg, bb] = rgb(b);
  return pack(lerp(ar, br, t), lerp(ag, bg, t), lerp(ab, bb, t));
};

export const scaleColor = (color: number, factor: number): number => {
  const [r, g, b] = rgb(color);
  return pack(r * factor, g * factor, b * factor);
};

/**
 * Parallax depth bands.
 *
 * `k` is the parallax coefficient (1 = the gameplay plane). `fog` is how much
 * atmospheric haze washes the band out, and `tint` picks a point on the scene
 * palette's far->near ramp. Together these give automatic aerial perspective:
 * authors place a prop at a depth and it is coloured correctly for free.
 */
export interface DepthBand {
  readonly name: string;
  readonly k: number;
  readonly fog: number;
  readonly tint: number;
}

export const DEPTHS: readonly DepthBand[] = [
  { name: 'void', k: 0.0, fog: 1.0, tint: 0.0 },
  { name: 'far', k: 0.18, fog: 0.78, tint: 0.08 },
  { name: 'midfar', k: 0.42, fog: 0.5, tint: 0.3 },
  { name: 'mid', k: 0.68, fog: 0.26, tint: 0.58 },
  { name: 'play', k: 1.0, fog: 0.07, tint: 0.85 },
  { name: 'near', k: 1.22, fog: 0.02, tint: 1.0 },
  { name: 'fore', k: 1.58, fog: 0.0, tint: 1.0 },
];

export const PLAY_DEPTH = 4;

/** Colour a prop at `depth` should be tinted, for the given temporal layer. */
export const depthTint = (
  palette: ScenePalette,
  depth: number,
  layer: 'present' | 'before',
): number => {
  const band = DEPTHS[Math.max(0, Math.min(DEPTHS.length - 1, Math.round(depth)))];
  if (layer === 'before') {
    // Before-layer art is lit by sodium lamps and firelight: warm, and it
    // loses much less value with distance because its own lights carry it.
    // The bias toward white keeps the tint a colour cast rather than a
    // dimmer - the past should look like a lit night, not a dark one.
    return mix(palette.beforeKey, 0xffffff, 0.3 + band.tint * 0.4);
  }
  const ramp = mix(mix(palette.far, palette.mid, Math.min(1, band.tint * 2)), palette.near, band.tint);
  // Aerial perspective: distant bands shift toward the fog colour and lose
  // contrast, rather than simply getting darker. Because the band tint is a
  // multiply, the lift toward white is what keeps a distant ridge readable
  // instead of crushing it into the sky.
  const hazed = mix(ramp, palette.fog, band.fog * 0.5);
  // The lift toward white is driven by haze alone, so the gameplay plane and
  // the foreground stay as crisp dark silhouettes while distance goes soft.
  return mix(mix(hazed, palette.ambient, 0.2), 0xffffff, 0.02 + band.fog * 0.44);
};

/** Fog overlay alpha for a band. */
export const depthFog = (palette: ScenePalette, depth: number): number => {
  const band = DEPTHS[Math.max(0, Math.min(DEPTHS.length - 1, Math.round(depth)))];
  return band.fog * palette.fogStrength;
};

/**
 * Shared palettes. Every location is the same valley on the same night, so the
 * six palettes are deliberately close relatives: cold slate and silt for the
 * present, one warm sodium key for the Before.
 */
export const PALETTES: Readonly<Record<string, ScenePalette>> = {
  /** Dusk over the drained reservoir: cold, open, enormous. */
  shore: {
    skyTop: 0x0a1018,
    skyBottom: 0x2b3741,
    far: 0x2d3a44,
    mid: 0x212b34,
    near: 0x161d24,
    ground: 0x10161b,
    fog: 0x5d6e78,
    fogStrength: 0.85,
    darkness: 0.46,
    ambient: 0x82a0ae,
    beforeKey: 0xffb866,
  },
  /** The high street. Tighter, darker, with the sky squeezed to a slot. */
  highstreet: {
    skyTop: 0x070c13,
    skyBottom: 0x1b2630,
    far: 0x232e38,
    mid: 0x1a232b,
    near: 0x12181e,
    ground: 0x0c1115,
    fog: 0x4e5f6a,
    fogStrength: 0.72,
    darkness: 0.62,
    ambient: 0x6c8b9c,
    beforeKey: 0xffb25e,
  },
  /** The sunken ward. Interior, almost lightless, green with algae. */
  ward: {
    skyTop: 0x040709,
    skyBottom: 0x0b1113,
    far: 0x18221f,
    mid: 0x131b19,
    near: 0x0e1413,
    ground: 0x080c0c,
    fog: 0x3e524c,
    fogStrength: 0.6,
    darkness: 0.82,
    ambient: 0x5c8378,
    beforeKey: 0xffc07a,
  },
  /** Mill tunnels. Rust and lamp-black, the warmest present-day palette. */
  tunnels: {
    skyTop: 0x050403,
    skyBottom: 0x0d0a08,
    far: 0x1e1814,
    mid: 0x17120f,
    near: 0x100c0a,
    ground: 0x0a0807,
    fog: 0x4a3c32,
    fogStrength: 0.48,
    darkness: 0.87,
    ambient: 0x8a7159,
    beforeKey: 0xffbb63,
  },
  /** The gatehouse. Grey machinery, one high window, moonlight on brass. */
  gatehouse: {
    skyTop: 0x080d14,
    skyBottom: 0x1d2730,
    far: 0x252f38,
    mid: 0x1c242b,
    near: 0x141a20,
    ground: 0x0d1216,
    fog: 0x51616d,
    fogStrength: 0.55,
    darkness: 0.72,
    ambient: 0x7993a6,
    beforeKey: 0xffba62,
  },
  /** The drowning gate. The valley opens up again; water is coming back. */
  gate: {
    skyTop: 0x0b1220,
    skyBottom: 0x33404c,
    far: 0x35434f,
    mid: 0x27323c,
    near: 0x1a2229,
    ground: 0x121920,
    fog: 0x6c7f8c,
    fogStrength: 0.9,
    darkness: 0.44,
    ambient: 0x93b1c2,
    beforeKey: 0xffad5a,
  },
};
