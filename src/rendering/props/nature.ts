import { Rng } from '@/core/rng';
import { type PropDraw, jaggedTop, vl } from './context';

/** The drained reservoir bed: silt dunes, dead timber, stranded water. */

export const silt: PropDraw = (ctx) => {
  const { g, rng } = ctx;
  const w = ctx.num('w', 300);
  const h = ctx.num('h', 60);
  const pts = jaggedTop(rng, 0, w, 0, h, Math.max(10, Math.round(w / 14)));
  g.poly([[0, 0], ...pts, [w, 0]].flat()).fill({ color: vl(ctx, 0.14) });
  // Lit crest: a thin rim light along the top edge sells the form.
  const rim: number[] = [];
  for (const [px, py] of pts) rim.push(px, py);
  g.poly(rim).stroke({ width: 2, color: vl(ctx, 0.3), alpha: 0.55 });
  // Desiccation cracks.
  for (let i = 0; i < Math.round(w / 30); i++) {
    const cx = rng.next() * w;
    const idx = Math.min(pts.length - 1, Math.floor((cx / w) * (pts.length - 1)));
    const cy = pts[idx][1];
    const seg: number[] = [cx, cy];
    let x = cx;
    let y = cy;
    for (let s = 0; s < 4; s++) {
      x += rng.signed() * 11;
      y += rng.range(3, 12);
      if (y > -1) break;
      seg.push(x, y);
    }
    if (seg.length >= 6) g.poly(seg).stroke({ width: 1, color: vl(ctx, 0.05), alpha: 0.45 });
  }
};

/**
 * Distant valley sides.
 *
 * Rolling fbm silhouettes rather than the blocky `roofline` prop, which is for
 * towns: used as a horizon, a roofline reads as an enormous flat-topped grey
 * slab sitting behind the action.
 */
export const hills: PropDraw = (ctx) => {
  const { g, rng } = ctx;
  const w = ctx.num('w', 1600);
  const h = ctx.num('h', 240);
  const ridges = Math.max(1, Math.round(ctx.num('ridges', 2)));

  for (let r = 0; r < ridges; r++) {
    const scale = 1 - r * 0.28;
    const pts: number[] = [];
    const steps = Math.max(12, Math.round(w / 26));
    const seedA = rng.range(0, 100);
    const seedB = rng.range(0, 100);
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = t * w;
      // Two octaves: a long shoulder and a finer crest.
      const long = Math.sin(t * Math.PI * (1.1 + r * 0.4) + seedA) * 0.5 + 0.5;
      const fine =
        Math.sin(t * Math.PI * (5.3 + r) + seedB) * 0.18 +
        Math.sin(t * Math.PI * (11.7 + r * 2) + seedB * 2) * 0.07;
      const y = -(h * scale) * (0.42 + long * 0.58 + fine);
      pts.push(x, y);
    }
    // Fill far below the baseline: the bottom of a distant hill is hidden
    // behind nearer layers, and a short fill leaves a hard seam across the sky.
    pts.push(w, h * 2 + 700, 0, h * 2 + 700);
    g.poly(pts).fill({ color: vl(ctx, 0.1 + r * 0.035) });
  }
  // A cold rim along the nearest crest, which is what gives the valley scale.
  if (ctx.bool('rim', true)) {
    const steps = Math.max(12, Math.round(w / 26));
    const rim: number[] = [];
    const seedA = rng.range(0, 100);
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const long = Math.sin(t * Math.PI * 1.1 + seedA) * 0.5 + 0.5;
      rim.push(t * w, -h * (0.42 + long * 0.58) + 1.5);
    }
    g.poly(rim).stroke({ width: 1.6, color: vl(ctx, 0.32), alpha: 0.35 });
  }
};

export const deadtree: PropDraw = (ctx) => {
  const { g, rng } = ctx;
  const h = ctx.num('h', 180);
  const thick = ctx.num('thick', 9);
  const lean = ctx.num('lean', 0);
  const depth = Math.max(2, Math.round(ctx.num('depth', 4)));
  const value = ctx.num('value', 0.1);

  const branch = (
    x: number,
    y: number,
    angle: number,
    len: number,
    width: number,
    level: number,
  ): void => {
    const ex = x + Math.sin(angle) * len;
    const ey = y - Math.cos(angle) * len;
    // Taper each limb for a believable silhouette.
    g.poly([
      x - width / 2, y,
      x + width / 2, y,
      ex + (width * 0.4) / 2, ey,
      ex - (width * 0.4) / 2, ey,
    ]).fill({ color: vl(ctx, value + level * 0.012) });
    if (level >= depth || len < 9) return;
    const splits = rng.chance(0.78) ? 2 : 3;
    for (let i = 0; i < splits; i++) {
      const spread = rng.range(0.3, 0.85) * (i === 0 ? -1 : 1) * (splits === 3 && i === 2 ? 0.2 : 1);
      branch(ex, ey, angle + spread, len * rng.range(0.55, 0.76), width * 0.62, level + 1);
    }
  };

  branch(0, 0, lean, h * 0.42, thick, 0);
  // Exposed root plate: these trees drowned standing.
  for (let i = 0; i < 5; i++) {
    const dir = i % 2 === 0 ? 1 : -1;
    g.poly([
      0, 0,
      dir * rng.range(10, 30), rng.range(-3, 3),
      dir * rng.range(14, 38), 6,
      0, 5,
    ]).fill({ color: vl(ctx, value + 0.02) });
  }
};

/** Stranded water: a still pool with a bright surface line and reflections. */
export const waterline: PropDraw = (ctx) => {
  const { g, rng } = ctx;
  const w = ctx.num('w', 400);
  const d = ctx.num('d', 30);
  const value = ctx.num('value', 0.09);

  g.rect(0, 0, w, d).fill({ color: vl(ctx, value) });
  // Surface: the single brightest line in the composition.
  g.rect(0, 0, w, 1.6).fill({ color: vl(ctx, 0.52), alpha: 0.8 });
  g.rect(0, 1.6, w, 4).fill({ color: vl(ctx, 0.3), alpha: 0.3 });
  // Broken horizontal reflections.
  for (let i = 0; i < Math.round(w / 9); i++) {
    const x = rng.next() * w;
    const y = rng.range(2, d * 0.8);
    g.rect(x, y, rng.range(5, 26), rng.range(0.7, 1.8))
      .fill({ color: vl(ctx, 0.4), alpha: rng.range(0.05, 0.22) });
  }
};

export const reeds: PropDraw = (ctx) => {
  const { g, rng } = ctx;
  const w = ctx.num('w', 120);
  const h = ctx.num('h', 46);
  const count = Math.max(4, Math.round(ctx.num('count', w / 7)));
  for (let i = 0; i < count; i++) {
    const x = rng.next() * w;
    const bh = h * rng.range(0.4, 1);
    const bend = rng.signed() * bh * 0.4;
    const pts: number[] = [];
    for (let s = 0; s <= 5; s++) {
      const t = s / 5;
      pts.push(x + bend * t * t, -bh * t);
    }
    g.poly(pts).stroke({ width: rng.range(0.8, 1.8), color: vl(ctx, 0.1 + rng.next() * 0.1) });
  }
};

/** Hanging weed and root curtains in the tunnels. */
export const weedcurtain: PropDraw = (ctx) => {
  const { g, rng } = ctx;
  const w = ctx.num('w', 160);
  const h = ctx.num('h', 60);
  const count = Math.max(6, Math.round(w / 6));
  for (let i = 0; i < count; i++) {
    const x = (i / count) * w + rng.signed() * 3;
    const len = h * rng.range(0.25, 1);
    const pts: number[] = [];
    for (let s = 0; s <= 4; s++) {
      const t = s / 4;
      pts.push(x + Math.sin(t * 2.2 + i) * 3, len * t);
    }
    g.poly(pts).stroke({ width: rng.range(0.7, 2.2), color: vl(ctx, 0.07), alpha: 0.85 });
  }
};

/** A tilting fence line marking a drowned field boundary. */
export const fenceline: PropDraw = (ctx) => {
  const { g, rng } = ctx;
  const w = ctx.num('w', 240);
  const h = ctx.num('h', 38);
  for (let x = 0; x < w; x += 30) {
    const lean = rng.signed() * 0.22;
    const ph = h * rng.range(0.7, 1.05);
    g.poly([
      x, 0,
      x + 4, 0,
      x + 4 + Math.sin(lean) * ph, -ph,
      x + Math.sin(lean) * ph, -ph,
    ]).fill({ color: vl(ctx, 0.12) });
  }
  // Sagging wire.
  for (const frac of [0.35, 0.68]) {
    const pts: number[] = [];
    for (let i = 0; i <= Math.round(w / 10); i++) {
      const x = (i / Math.round(w / 10)) * w;
      const sag = Math.sin(((x % 30) / 30) * Math.PI) * 3;
      pts.push(x, -h * frac + sag);
    }
    g.poly(pts).stroke({ width: 1, color: vl(ctx, 0.17), alpha: 0.7 });
  }
};

/** Deterministic detail scatter helper for scene authors. */
export const scatterSeed = (id: string): Rng => new Rng(id.length * 2654435761);
