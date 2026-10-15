import { type PropDraw, vl } from './context';

/** Schoolhouse, infirmary ward and gatehouse interiors. */

export const interiorwall: PropDraw = (ctx) => {
  const { g, rng } = ctx;
  const w = ctx.num('w', 400);
  const h = ctx.num('h', 220);
  const value = ctx.num('value', 0.15);
  const dado = ctx.bool('dado', true);
  const top = -h;

  g.rect(0, top, w, h).fill({ color: vl(ctx, value) });
  // Blown plaster revealing lath and brick beneath.
  for (let i = 0; i < Math.round(w / 90); i++) {
    const px = rng.next() * w;
    const py = top + rng.next() * h * 0.8;
    const pw = rng.range(26, 90);
    const ph = rng.range(20, 70);
    g.poly([
      px, py,
      px + pw, py - rng.range(0, 12),
      px + pw * rng.range(0.8, 1.1), py + ph,
      px - rng.range(0, 10), py + ph * rng.range(0.7, 1),
    ]).fill({ color: vl(ctx, value - 0.06) });
    for (let l = 0; l < Math.round(ph / 7); l++) {
      g.rect(px, py + l * 7, pw, 2.4).fill({ color: vl(ctx, value + 0.04), alpha: 0.4 });
    }
  }
  if (dado) {
    const dh = ctx.num('dadoH', 74);
    g.rect(0, -dh, w, dh).fill({ color: vl(ctx, value - 0.04) });
    g.rect(0, -dh, w, 4).fill({ color: vl(ctx, value + 0.09) });
    g.rect(0, -dh + 4, w, 2).fill({ color: vl(ctx, value - 0.09), alpha: 0.6 });
  }
  // Skirting and the silt line left by sixty years underwater.
  g.rect(0, -11, w, 11).fill({ color: vl(ctx, value - 0.07) });
  const tide = ctx.num('tide', h * 0.3);
  g.rect(0, -tide, w, tide).fill({ color: vl(ctx, value - 0.06), alpha: 0.6 });
  g.rect(0, -tide, w, 2.6).fill({ color: vl(ctx, value + 0.14), alpha: 0.55 });
};

export const windowtall: PropDraw = (ctx) => {
  const { g, rng } = ctx;
  const w = ctx.num('w', 54);
  const h = ctx.num('h', 120);
  const lit = ctx.bool('lit', false);
  const broken = ctx.bool('broken', !lit);
  const top = -h;

  g.rect(-5, top - 5, w + 10, h + 5).fill({ color: vl(ctx, 0.2) });
  g.rect(0, top, w, h).fill({ color: vl(ctx, lit ? 0.62 : 0.04) });
  // Glazing bars.
  const cols = Math.max(1, Math.round(ctx.num('cols', 2)));
  const rows = Math.max(1, Math.round(ctx.num('rows', 4)));
  for (let c = 1; c < cols; c++) {
    g.rect((w / cols) * c - 1.4, top, 2.8, h).fill({ color: vl(ctx, 0.21) });
  }
  for (let r = 1; r < rows; r++) {
    g.rect(0, top + (h / rows) * r - 1.4, w, 2.8).fill({ color: vl(ctx, 0.21) });
  }
  if (broken) {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!rng.chance(0.55)) continue;
        const px = (w / cols) * c;
        const py = top + (h / rows) * r;
        g.poly([
          px, py,
          px + w / cols, py,
          px + (w / cols) * rng.range(0.3, 0.8), py + (h / rows) * rng.range(0.3, 0.7),
        ]).fill({ color: vl(ctx, 0.17), alpha: 0.75 });
      }
    }
  }
  // Sill with a highlight so the window reads against a dark wall.
  g.rect(-8, 0, w + 16, 5).fill({ color: vl(ctx, 0.26) });
  g.rect(-8, 0, w + 16, 1.6).fill({ color: vl(ctx, 0.36) });
};

export const furniture: PropDraw = (ctx) => {
  const { g, rng } = ctx;
  const style = ctx.str('style', 'desk');
  const w = ctx.num('w', 54);
  const h = ctx.num('h', 38);
  const toppled = ctx.bool('toppled', false);

  if (toppled) {
    // Everything in the ward has been moved by water at some point.
    g.rect(0, -h * 0.35, w * 1.1, h * 0.35).fill({ color: vl(ctx, 0.14) });
    g.rect(0, -h * 0.35, w * 1.1, 2.4).fill({ color: vl(ctx, 0.25) });
    for (let i = 0; i < 3; i++) {
      g.rect(w * 0.15 + i * w * 0.3, -h * 0.35 - rng.range(8, 20), 4, rng.range(8, 20))
        .fill({ color: vl(ctx, 0.16) });
    }
    return;
  }

  if (style === 'desk' || style === 'table' || style === 'bench') {
    const legInset = style === 'bench' ? 4 : 6;
    g.rect(0, -h, w, style === 'bench' ? 5 : 7).fill({ color: vl(ctx, 0.19) });
    g.rect(0, -h, w, 2.2).fill({ color: vl(ctx, 0.3) });
    for (const lx of [legInset, w - legInset - 5]) {
      g.rect(lx, -h + 6, 5, h - 6).fill({ color: vl(ctx, 0.15) });
    }
    if (style === 'desk') {
      // Sloped school desk lid with an inkwell hole.
      g.poly([0, -h, w, -h, w, -h - 9, 0, -h - 4]).fill({ color: vl(ctx, 0.21) });
      g.circle(w - 11, -h - 6, 3).fill({ color: vl(ctx, 0.06) });
      g.rect(2, -h + 12, w - 4, 3).fill({ color: vl(ctx, 0.14) });
    }
  } else if (style === 'bed') {
    // Iron infirmary cot.
    for (const bx of [2, w - 6]) {
      g.rect(bx, -h, 4, h).fill({ color: vl(ctx, 0.2) });
      g.circle(bx + 2, -h - 2, 3).fill({ color: vl(ctx, 0.24) });
    }
    g.rect(0, -h * 0.52, w, 4).fill({ color: vl(ctx, 0.21) });
    g.rect(2, -h, 6, h * 0.5).fill({ color: vl(ctx, 0.22) });
    g.rect(w - 10, -h, 6, h * 0.34).fill({ color: vl(ctx, 0.22) });
    // Sagging mattress, grey with silt.
    g.poly([3, -h * 0.5, w - 3, -h * 0.5, w - 3, -h * 0.5 + 10, 3, -h * 0.5 + 13])
      .fill({ color: vl(ctx, 0.26) });
    g.rect(3, -h * 0.5, w - 6, 2).fill({ color: vl(ctx, 0.34) });
  } else if (style === 'shelf') {
    g.rect(0, -h, w, h).fill({ color: vl(ctx, 0.12) });
    const shelves = Math.max(2, Math.round(h / 34));
    for (let i = 0; i <= shelves; i++) {
      const sy = -h + (h / shelves) * i;
      g.rect(0, sy, w, 4).fill({ color: vl(ctx, 0.2) });
      g.rect(0, sy, w, 1.4).fill({ color: vl(ctx, 0.29) });
      // Ledgers and boxes, leaning.
      let bx = rng.range(2, 8);
      while (bx < w - 10) {
        const bw = rng.range(4, 11);
        const bh = Math.min(h / shelves - 7, rng.range(14, 26));
        const lean = rng.chance(0.2) ? rng.signed() * 5 : 0;
        g.poly([
          bx, sy, bx + bw, sy,
          bx + bw + lean, sy - bh, bx + lean, sy - bh,
        ]).fill({ color: vl(ctx, 0.14 + rng.next() * 0.1) });
        bx += bw + rng.range(1, 4);
      }
    }
    g.rect(0, -h, 4, h).fill({ color: vl(ctx, 0.17) });
    g.rect(w - 4, -h, 4, h).fill({ color: vl(ctx, 0.15) });
  } else if (style === 'chair') {
    g.rect(2, -h * 0.5, w - 4, 4).fill({ color: vl(ctx, 0.2) });
    for (const lx of [3, w - 7]) g.rect(lx, -h * 0.5, 4, h * 0.5).fill({ color: vl(ctx, 0.16) });
    g.rect(w - 8, -h, 4, h * 0.56).fill({ color: vl(ctx, 0.18) });
    g.rect(w - 14, -h, 12, 3).fill({ color: vl(ctx, 0.2) });
  } else {
    // crate / trunk
    g.rect(0, -h, w, h).fill({ color: vl(ctx, 0.16) });
    g.rect(0, -h, w, 3).fill({ color: vl(ctx, 0.25) });
    g.rect(0, -h, 4, h).fill({ color: vl(ctx, 0.2) });
    g.rect(w - 4, -h, 4, h).fill({ color: vl(ctx, 0.13) });
    g.poly([0, -h, w, 0]).stroke({ width: 2, color: vl(ctx, 0.2), alpha: 0.6 });
    g.poly([w, -h, 0, 0]).stroke({ width: 2, color: vl(ctx, 0.2), alpha: 0.6 });
  }
};

/**
 * Chalkboard, and the chalk marks the children left.
 *
 * The ward puzzle is read off these: the symbols are gameplay, so they are
 * drawn with deliberate clarity rather than as texture.
 */
export const chalkboard: PropDraw = (ctx) => {
  const { g, rng } = ctx;
  const w = ctx.num('w', 150);
  const h = ctx.num('h', 86);
  const top = -h;

  g.rect(-5, top - 5, w + 10, h + 10).fill({ color: vl(ctx, 0.2) });
  g.rect(-5, top - 5, w + 10, 3).fill({ color: vl(ctx, 0.28) });
  g.rect(0, top, w, h).fill({ color: vl(ctx, 0.07) });
  // Ghosts of a hundred erasures.
  for (let i = 0; i < 24; i++) {
    g.rect(rng.next() * w, top + rng.next() * h, rng.range(10, 50), rng.range(3, 12))
      .fill({ color: vl(ctx, 0.14), alpha: rng.range(0.04, 0.12) });
  }
  // Chalk tray.
  g.rect(-5, -4, w + 10, 5).fill({ color: vl(ctx, 0.22) });
  g.rect(8, -6, 12, 3).fill({ color: vl(ctx, 0.52) });
};

/**
 * One of the four chalk glyphs. The ward's safe route is marked in chalk by
 * children who learned the rule the hard way: the beam wakes them.
 */
export const chalkglyph: PropDraw = (ctx) => {
  const { g } = ctx;
  const s = ctx.num('s', 20);
  const glyph = ctx.str('glyph', 'cross');
  const alpha = ctx.num('alpha', 0.72);
  const col = vl(ctx, 0.78);
  const stroke = { width: Math.max(1.6, s * 0.1), color: col, alpha };

  if (glyph === 'cross') {
    g.poly([-s, -s, s, s]).stroke(stroke);
    g.poly([s, -s, -s, s]).stroke(stroke);
  } else if (glyph === 'arrow') {
    g.poly([-s, 0, s, 0]).stroke(stroke);
    g.poly([s * 0.3, -s * 0.6, s, 0, s * 0.3, s * 0.6]).stroke(stroke);
  } else if (glyph === 'eye') {
    g.poly([-s, 0, -s * 0.4, -s * 0.6, s * 0.4, -s * 0.6, s, 0, s * 0.4, s * 0.6, -s * 0.4, s * 0.6, -s, 0])
      .stroke(stroke);
    g.circle(0, 0, s * 0.3).stroke(stroke);
  } else if (glyph === 'wave') {
    const pts: number[] = [];
    for (let i = 0; i <= 12; i++) {
      const t = i / 12;
      pts.push(-s + t * s * 2, Math.sin(t * Math.PI * 2) * s * 0.45);
    }
    g.poly(pts).stroke(stroke);
  } else if (glyph === 'tally') {
    const n = Math.max(1, Math.round(ctx.num('count', 3)));
    for (let i = 0; i < n; i++) {
      const x = -s + (i / Math.max(1, n - 1 || 1)) * s * 2 * (n === 1 ? 0 : 1);
      g.poly([x, -s, x + s * 0.18, s]).stroke(stroke);
    }
  } else {
    // 'hush': a closed mouth
    g.poly([-s, 0, -s * 0.4, s * 0.35, s * 0.4, s * 0.35, s, 0]).stroke(stroke);
  }
};

export const curtain: PropDraw = (ctx) => {
  const { g, rng } = ctx;
  const w = ctx.num('w', 60);
  const h = ctx.num('h', 110);
  const folds = Math.max(3, Math.round(w / 11));
  const value = ctx.num('value', 0.17);

  // Rail.
  g.rect(-4, -h - 4, w + 8, 4).fill({ color: vl(ctx, 0.22) });
  for (let i = 0; i < folds; i++) {
    const x = (i / folds) * w;
    const fw = w / folds;
    const sway = Math.sin(i * 1.7) * 3;
    const shade = i % 2 === 0 ? value + 0.05 : value - 0.03;
    g.poly([
      x, -h,
      x + fw, -h,
      x + fw + sway, -rng.range(4, 14),
      x + sway, -rng.range(4, 14),
    ]).fill({ color: vl(ctx, shade) });
  }
  // Torn hem.
  for (let i = 0; i < folds; i++) {
    const x = (i / folds) * w;
    g.poly([x, -rng.range(4, 14), x + w / folds, -rng.range(2, 10), x + w / folds, 0, x, 0])
      .fill({ color: vl(ctx, value - 0.05), alpha: 0.7 });
  }
};

export const hanginglamp: PropDraw = (ctx) => {
  const { g } = ctx;
  const cord = ctx.num('cord', 50);
  const r = ctx.num('r', 13);
  const lit = ctx.bool('lit', ctx.layer === 'before');

  g.rect(-1, -cord - r, 2, cord).fill({ color: vl(ctx, 0.18) });
  // Enamel shade.
  g.poly([-r, 0, r, 0, r * 0.3, -r * 0.9, -r * 0.3, -r * 0.9])
    .fill({ color: vl(ctx, lit ? 0.3 : 0.15) });
  g.rect(-r, -1.5, r * 2, 2.5).fill({ color: vl(ctx, lit ? 0.44 : 0.2) });
  if (lit) {
    g.circle(0, 3, r * 0.42).fill({ color: vl(ctx, 0.95), alpha: 0.9 });
    // Underside of the shade catching its own bulb.
    g.poly([-r, 0, r, 0, r * 0.4, -4, -r * 0.4, -4]).fill({ color: vl(ctx, 0.7), alpha: 0.35 });
  } else {
    g.circle(0, 3, r * 0.3).fill({ color: vl(ctx, 0.1) });
  }
};

export const lamppost: PropDraw = (ctx) => {
  const { g } = ctx;
  const h = ctx.num('h', 150);
  const lit = ctx.bool('lit', ctx.layer === 'before');
  const flip = ctx.bool('armFlip', false);
  const dir = flip ? -1 : 1;

  // Base.
  g.poly([-9, 0, 9, 0, 6, -14, -6, -14]).fill({ color: vl(ctx, 0.2) });
  g.rect(-3.2, -h, 6.4, h - 12).fill({ color: vl(ctx, 0.17) });
  g.rect(-3.2, -h, 2, h - 12).fill({ color: vl(ctx, 0.24) });
  // Scrolled arm.
  const pts: number[] = [];
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    pts.push(dir * t * 26, -h - Math.sin(t * Math.PI * 0.5) * 16);
  }
  g.poly(pts).stroke({ width: 4, color: vl(ctx, 0.19) });
  // Lantern head.
  const hx = dir * 26;
  const hy = -h - 16;
  g.poly([hx - 9, hy, hx + 9, hy, hx + 6, hy + 20, hx - 6, hy + 20])
    .fill({ color: vl(ctx, lit ? 0.5 : 0.12) });
  g.poly([hx - 10, hy, hx + 10, hy, hx, hy - 9]).fill({ color: vl(ctx, 0.21) });
  if (lit) {
    g.poly([hx - 7, hy + 2, hx + 7, hy + 2, hx + 4.5, hy + 18, hx - 4.5, hy + 18])
      .fill({ color: vl(ctx, 0.98), alpha: 0.85 });
  } else {
    g.poly([hx - 7, hy + 2, hx + 7, hy + 2, hx + 4.5, hy + 18, hx - 4.5, hy + 18])
      .fill({ color: vl(ctx, 0.04) });
    // A lamppost with no glass left.
    g.poly([hx - 7, hy + 2, hx + 1, hy + 11]).stroke({ width: 1.4, color: vl(ctx, 0.22) });
  }
};
