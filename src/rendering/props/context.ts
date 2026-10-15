import type { Container, Graphics } from 'pixi.js';
import type { Rng } from '@/core/rng';
import type { Layer } from '@/physics/types';

/**
 * Props are drawn in a neutral VALUE ramp, not in final colour.
 *
 * The scene renderer tints each parallax depth band with the scene palette and
 * layers fog over it. That single rule is what makes six very different
 * locations read as one art direction, and it is what lets the same prop serve
 * as a near silhouette and a distant haze-washed shape.
 */
export interface PropCtx {
  /** Graphics object to draw into. Origin is the placement point. */
  readonly g: Graphics;
  /** The prop's container, for adding sprites (textures, glows). */
  readonly root: Container;
  readonly rng: Rng;
  readonly layer: Layer;
  num(key: string, fallback: number): number;
  str(key: string, fallback: string): string;
  bool(key: string, fallback: boolean): boolean;
}

export type PropDraw = (ctx: PropCtx) => void;

/**
 * Neutral value ramp: 0 = deepest shadow, 1 = highlight.
 * Carries a faint cool cast so untinted detail still feels like damp stone.
 */
export const v = (value: number): number => {
  const t = Math.max(0, Math.min(1, value));
  const r = Math.round(14 + t * 228);
  const g = Math.round(17 + t * 230);
  const b = Math.round(22 + t * 226);
  return (r << 16) | (g << 8) | b;
};

/** Warm value ramp for Before-layer interiors - lamplight on old plaster. */
export const vw = (value: number): number => {
  // Lifted well off black: the Before layer is lit by its own lamps and sits
  // above the darkness, so its darkest value is a warm shadow rather than a
  // silhouette. Pushing this ramp down is what made 1964 read as a dim cave.
  const t = Math.max(0, Math.min(1, value));
  const r = Math.round(74 + t * 181);
  const g = Math.round(58 + t * 176);
  const b = Math.round(42 + t * 150);
  return (r << 16) | (g << 8) | b;
};

/**
 * Ramp appropriate to the prop's temporal layer.
 *
 * Note the remap for Before-layer art. Prop values are authored as present-day
 * silhouette values, where 0.15 is a dark shape against a dark sky. The same
 * number on the Before layer has to describe a room with the lights on, so it
 * is lifted into the top two thirds of the warm ramp. Without this the past
 * renders technically correctly and looks like an unlit cellar, which is the
 * opposite of what the beam is supposed to show.
 */
export const vl = (ctx: PropCtx, value: number): number => {
  const t = Math.max(0, Math.min(1, value));
  // Both ramps are remapped into their upper range. Prop values are authored
  // as relative tone (0.1 is "the dark part of this object"), and the scene
  // renderer then multiplies by a band tint - so authoring near zero and
  // multiplying by a dark tint crushes everything to black twice over.
  return ctx.layer === 'before' ? vw(0.3 + t * 0.7) : v(0.16 + t * 0.84);
};

/** Irregular polygon edge, for silt, rubble and broken masonry. */
export const jaggedTop = (
  rng: Rng,
  x0: number,
  x1: number,
  baseY: number,
  amp: number,
  steps: number,
): Array<[number, number]> => {
  const pts: Array<[number, number]> = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = x0 + (x1 - x0) * t;
    const hump = Math.sin(t * Math.PI) ** 0.7;
    pts.push([x, baseY - hump * amp - rng.signed() * amp * 0.22]);
  }
  return pts;
};
