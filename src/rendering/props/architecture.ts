import { type PropCtx, type PropDraw, jaggedTop, vl } from './context';

/**
 * Buildings of Corran Mill. All architecture props use a BOTTOM-LEFT origin so
 * a street can be laid out by walking x along the ground line.
 */

const windowGrid = (
  ctx: PropCtx,
  x: number,
  y: number,
  w: number,
  h: number,
  cols: number,
  rows: number,
  lit: boolean,
): void => {
  const { g, rng } = ctx;
  const padX = w * 0.12;
  const padY = h * 0.1;
  const cw = (w - padX * 2) / cols;
  const ch = (h - padY * 2) / rows;
  const ww = cw * 0.56;
  const wh = ch * 0.62;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const wx = x + padX + c * cw + (cw - ww) / 2;
      const wy = y + padY + r * ch + (ch - wh) / 2;
      // Recessed reveal.
      g.rect(wx - 2, wy - 2, ww + 4, wh + 4).fill({ color: vl(ctx, 0.07) });
      const broken = !lit && rng.chance(0.42);
      const shade = lit ? 0.78 + rng.next() * 0.18 : broken ? 0.03 : 0.12;
      g.rect(wx, wy, ww, wh).fill({ color: vl(ctx, shade) });
      if (broken) {
        // Jagged remnants of glass.
        for (let i = 0; i < 3; i++) {
          const sx = wx + rng.next() * ww;
          g.poly([
            sx, wy,
            sx + rng.range(3, 9), wy,
            sx + rng.range(1, 5), wy + rng.range(4, wh * 0.6),
          ]).fill({ color: vl(ctx, 0.3), alpha: 0.5 });
        }
      }
      // Mullions.
      g.rect(wx + ww / 2 - 0.9, wy, 1.8, wh).fill({ color: vl(ctx, lit ? 0.18 : 0.06) });
      g.rect(wx, wy + wh * 0.46, ww, 1.8).fill({ color: vl(ctx, lit ? 0.18 : 0.06) });
      // Sill.
      g.rect(wx - 3, wy + wh, ww + 6, 2.6).fill({ color: vl(ctx, 0.26) });
      if (lit) {
        // Warm spill onto the sill and the wall below.
        g.rect(wx - 4, wy + wh + 2.6, ww + 8, 7).fill({ color: vl(ctx, 0.5), alpha: 0.28 });
      }
    }
  }
};

export const facade: PropDraw = (ctx) => {
  const { g, rng } = ctx;
  const w = ctx.num('w', 180);
  const h = ctx.num('h', 220);
  const floors = Math.max(1, Math.round(ctx.num('floors', 2)));
  const cols = Math.max(1, Math.round(ctx.num('cols', 3)));
  const lit = ctx.bool('lit', ctx.layer === 'before');
  const style = ctx.str('style', 'house');
  const roof = ctx.str('roof', style === 'mill' ? 'flat' : 'gable');

  const top = -h;

  // Main mass.
  g.rect(0, top, w, h).fill({ color: vl(ctx, 0.17) });
  // Vertical value break so the wall is not flat.
  g.rect(0, top, w * 0.3, h).fill({ color: vl(ctx, 0.2), alpha: 0.5 });
  g.rect(w * 0.82, top, w * 0.18, h).fill({ color: vl(ctx, 0.11), alpha: 0.6 });

  if (style === 'mill' || style === 'stone' || style === 'chapel') {
    // Coursed stone banding.
    const course = 13;
    for (let y = top; y < 0; y += course) {
      g.rect(0, y, w, 1).fill({ color: vl(ctx, 0.1), alpha: 0.5 });
      const offset = ((y - top) / course) % 2 === 0 ? 0 : course * 1.4;
      for (let x = offset; x < w; x += course * 2.8) {
        g.rect(x, y, 1, course).fill({ color: vl(ctx, 0.1), alpha: 0.35 });
      }
    }
  }

  // Damp tide-mark: everything below the old waterline is darker and stained.
  const tide = ctx.num('tide', h * 0.42);
  if (tide > 0) {
    g.rect(0, -tide, w, tide).fill({ color: vl(ctx, 0.09), alpha: 0.72 });
    g.rect(0, -tide, w, 3).fill({ color: vl(ctx, 0.33), alpha: 0.65 });
    for (let i = 0; i < Math.round(w / 14); i++) {
      const sx = rng.next() * w;
      const sh = rng.range(6, tide * 0.7);
      g.rect(sx, -tide, rng.range(2, 9), sh).fill({ color: vl(ctx, 0.05), alpha: 0.4 });
    }
  }

  // Windows per floor.
  const floorH = h / floors;
  for (let f = 0; f < floors; f++) {
    const fy = top + f * floorH;
    windowGrid(ctx, 0, fy, w, floorH, cols, 1, lit && rng.chance(0.75));
    if (f > 0) g.rect(0, fy, w, 2).fill({ color: vl(ctx, 0.1), alpha: 0.6 });
  }

  // Ground-floor door or shopfront.
  if (style === 'shop') {
    const sw = w * 0.52;
    const sx = w * 0.1;
    const sh = floorH * 0.66;
    g.rect(sx - 3, -sh - 3, sw + 6, sh + 3).fill({ color: vl(ctx, 0.08) });
    g.rect(sx, -sh, sw, sh).fill({ color: vl(ctx, lit ? 0.62 : 0.05) });
    for (let i = 1; i < 3; i++) {
      g.rect(sx + (sw / 3) * i - 1, -sh, 2, sh).fill({ color: vl(ctx, 0.14) });
    }
    // Awning.
    g.poly([sx - 6, -sh, sx + sw + 6, -sh, sx + sw + 14, -sh + 16, sx - 14, -sh + 16])
      .fill({ color: vl(ctx, 0.25) });
    for (let i = 0; i < 7; i++) {
      g.rect(sx - 14 + i * ((sw + 28) / 7), -sh + 10, (sw + 28) / 14, 6)
        .fill({ color: vl(ctx, 0.14), alpha: 0.6 });
    }
  } else {
    const dw = 30;
    const dx = w * 0.5 - dw / 2;
    const dh = 54;
    g.rect(dx - 4, -dh - 4, dw + 8, dh + 4).fill({ color: vl(ctx, 0.23) });
    g.rect(dx, -dh, dw, dh).fill({ color: vl(ctx, lit ? 0.44 : 0.04) });
    if (lit) {
      g.poly([dx, 0, dx + dw, 0, dx + dw + 18, 26, dx - 18, 26])
        .fill({ color: vl(ctx, 0.6), alpha: 0.14 });
    }
    // Step.
    g.rect(dx - 8, -5, dw + 16, 5).fill({ color: vl(ctx, 0.2) });
  }

  // Roof.
  if (roof === 'gable') {
    const rh = ctx.num('roofH', 52);
    g.poly([-8, top, w + 8, top, w + 8, top - 4, w * 0.5, top - rh, -8, top - 4])
      .fill({ color: vl(ctx, 0.13) });
    g.poly([w * 0.5, top - rh, w + 8, top - 4, w + 8, top])
      .fill({ color: vl(ctx, 0.09) });
    // Slate courses.
    for (let i = 0; i < 7; i++) {
      const t = i / 7;
      g.poly([
        -8 + (w * 0.5 + 8) * t, top - 4 - (rh - 4) * t,
        w * 0.5, top - rh,
        w * 0.5, top - rh + 1,
        -8 + (w * 0.5 + 8) * t, top - 3 - (rh - 4) * t,
      ]).fill({ color: vl(ctx, 0.17), alpha: 0.35 });
    }
    // Ridge.
    g.rect(w * 0.5 - 2, top - rh, 4, 6).fill({ color: vl(ctx, 0.22) });
  } else if (roof === 'hip') {
    const rh = ctx.num('roofH', 34);
    g.poly([-6, top, w + 6, top, w * 0.78, top - rh, w * 0.22, top - rh])
      .fill({ color: vl(ctx, 0.12) });
  } else {
    // Flat parapet.
    g.rect(-6, top - 12, w + 12, 14).fill({ color: vl(ctx, 0.2) });
    g.rect(-6, top - 12, w + 12, 3).fill({ color: vl(ctx, 0.28) });
  }

  // Gutter and downpipe.
  if (ctx.bool('downpipe', true)) {
    const px = rng.chance(0.5) ? w - 9 : 5;
    g.rect(px, top, 4, h - 6).fill({ color: vl(ctx, 0.1) });
    for (let y = top + 20; y < -10; y += 46) {
      g.rect(px - 2, y, 8, 3).fill({ color: vl(ctx, 0.16) });
    }
  }
};

export const tower: PropDraw = (ctx) => {
  const { g, rng } = ctx;
  const w = ctx.num('w', 64);
  const h = ctx.num('h', 300);
  const style = ctx.str('style', 'bell');
  const lit = ctx.bool('lit', ctx.layer === 'before');
  const top = -h;

  g.rect(0, top, w, h).fill({ color: vl(ctx, 0.15) });
  g.rect(0, top, w * 0.34, h).fill({ color: vl(ctx, 0.19), alpha: 0.55 });

  // Batter: towers taper slightly.
  g.poly([0, top, -5, 0, 0, 0]).fill({ color: vl(ctx, 0.15) });
  g.poly([w, top, w + 5, 0, w, 0]).fill({ color: vl(ctx, 0.12) });

  const course = 15;
  for (let y = top; y < 0; y += course) {
    g.rect(0, y, w, 1).fill({ color: vl(ctx, 0.09), alpha: 0.5 });
  }

  const tide = ctx.num('tide', h * 0.3);
  g.rect(0, -tide, w, tide).fill({ color: vl(ctx, 0.08), alpha: 0.7 });
  g.rect(0, -tide, w, 3).fill({ color: vl(ctx, 0.3), alpha: 0.6 });

  if (style === 'bell') {
    // Belfry openings.
    const by = top + 22;
    const bw = w * 0.3;
    for (const bx of [w * 0.16, w * 0.54]) {
      g.rect(bx, by, bw, 56).fill({ color: vl(ctx, 0.03) });
      // Round-arched head.
      g.circle(bx + bw / 2, by, bw / 2).fill({ color: vl(ctx, 0.03) });
      g.rect(bx - 2, by - 2, bw + 4, 3).fill({ color: vl(ctx, 0.24) });
      if (lit) {
        g.rect(bx + 2, by + 6, bw - 4, 44).fill({ color: vl(ctx, 0.42), alpha: 0.35 });
      }
    }
    // Bell, hanging in the dark.
    const cx = w * 0.5;
    g.rect(cx - 1.5, top + 28, 3, 12).fill({ color: vl(ctx, 0.3) });
    g.poly([cx - 13, top + 64, cx - 9, top + 40, cx + 9, top + 40, cx + 13, top + 64])
      .fill({ color: vl(ctx, lit ? 0.46 : 0.2) });
    g.rect(cx - 14, top + 64, 28, 4).fill({ color: vl(ctx, lit ? 0.52 : 0.24) });
    // Spire.
    const sh = ctx.num('spireH', 90);
    g.poly([-9, top, w + 9, top, w * 0.5, top - sh]).fill({ color: vl(ctx, 0.1) });
    g.poly([w * 0.5, top - sh, w + 9, top, w * 0.5, top]).fill({ color: vl(ctx, 0.07) });
    // Weathervane.
    g.rect(w * 0.5 - 1, top - sh - 22, 2, 22).fill({ color: vl(ctx, 0.3) });
    g.poly([w * 0.5 - 1, top - sh - 20, w * 0.5 + 11, top - sh - 16, w * 0.5 - 1, top - sh - 12])
      .fill({ color: vl(ctx, 0.26) });
  } else if (style === 'intake') {
    // Concrete valve tower: ladder, railing, no windows.
    g.rect(w * 0.42, top + 6, 3, h - 40).fill({ color: vl(ctx, 0.26) });
    g.rect(w * 0.62, top + 6, 3, h - 40).fill({ color: vl(ctx, 0.26) });
    for (let y = top + 14; y < -30; y += 16) {
      g.rect(w * 0.42, y, w * 0.23, 2).fill({ color: vl(ctx, 0.3) });
    }
    g.rect(-10, top - 10, w + 20, 11).fill({ color: vl(ctx, 0.22) });
    for (let i = 0; i <= 6; i++) {
      g.rect(-10 + i * ((w + 20) / 6), top - 34, 2.5, 25).fill({ color: vl(ctx, 0.28) });
    }
    g.rect(-10, top - 36, w + 20, 3).fill({ color: vl(ctx, 0.32) });
    // Rust weeping from the fixings.
    for (let i = 0; i < 9; i++) {
      const sx = rng.next() * w;
      g.rect(sx, top + rng.range(10, h * 0.5), rng.range(2, 5), rng.range(20, 70))
        .fill({ color: vl(ctx, 0.26), alpha: 0.2 });
    }
  } else {
    // Chimney stack.
    g.rect(-3, top - 10, w + 6, 12).fill({ color: vl(ctx, 0.22) });
    for (let i = 0; i < 4; i++) {
      g.rect(0, top + 30 + i * 60, w, 6).fill({ color: vl(ctx, 0.21), alpha: 0.6 });
    }
  }
};

/** Background roofline silhouette - cheap mass for the far depth bands. */
export const roofline: PropDraw = (ctx) => {
  const { g, rng } = ctx;
  const w = ctx.num('w', 600);
  const h = ctx.num('h', 160);
  const count = Math.max(2, Math.round(ctx.num('count', 7)));
  let x = 0;
  for (let i = 0; i < count; i++) {
    const bw = (w / count) * rng.range(0.7, 1.35);
    const bh = h * rng.range(0.45, 1);
    // Extends below the baseline so the band has no hard bottom edge.
    g.rect(x, -bh, bw, bh + h * 1.5 + 400).fill({ color: vl(ctx, 0.12) });
    if (rng.chance(0.65)) {
      const rh = bh * rng.range(0.14, 0.3);
      g.poly([x - 3, -bh, x + bw + 3, -bh, x + bw * 0.5, -bh - rh])
        .fill({ color: vl(ctx, 0.1) });
    } else {
      g.rect(x - 2, -bh - 6, bw + 4, 7).fill({ color: vl(ctx, 0.14) });
    }
    if (rng.chance(0.5)) {
      const cx = x + bw * rng.range(0.2, 0.8);
      g.rect(cx, -bh - rng.range(14, 30), 9, 32).fill({ color: vl(ctx, 0.13) });
    }
    // A few faint windows to give the mass scale.
    if (ctx.bool('windows', true)) {
      const rows = Math.max(1, Math.floor(bh / 40));
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < Math.max(1, Math.floor(bw / 26)); c++) {
          if (!rng.chance(0.35)) continue;
          g.rect(x + 8 + c * 26, -bh + 12 + r * 40, 7, 10)
            .fill({ color: vl(ctx, ctx.layer === 'before' ? 0.55 : 0.07), alpha: 0.75 });
        }
      }
    }
    x += bw * rng.range(0.85, 1.05);
    if (x > w) break;
  }
};

/** Plain textured mass: dam faces, tunnel walls, concrete abutments. */
export const wallmass: PropDraw = (ctx) => {
  const { g, rng } = ctx;
  const w = ctx.num('w', 400);
  const h = ctx.num('h', 300);
  const value = ctx.num('value', 0.16);
  const batter = ctx.num('batter', 0);
  const top = -h;

  g.poly([0, 0, w, 0, w - batter, top, batter, top]).fill({ color: vl(ctx, value) });
  // Form-work seams: horizontal lifts of poured concrete.
  const lift = ctx.num('lift', 46);
  for (let y = top; y < 0; y += lift) {
    const t = (y - top) / h;
    const bx = batter * (1 - t);
    g.rect(bx, y, w - bx * 2, 1.6).fill({ color: vl(ctx, value - 0.05), alpha: 0.7 });
    g.rect(bx, y + 1.6, w - bx * 2, 2).fill({ color: vl(ctx, value + 0.06), alpha: 0.35 });
  }
  // Vertical form marks.
  for (let x = 0; x < w; x += ctx.num('panel', 96)) {
    g.rect(x, top, 1.4, h).fill({ color: vl(ctx, value - 0.04), alpha: 0.5 });
  }
  // Staining and algal bloom near the base.
  for (let i = 0; i < Math.round(w / 22); i++) {
    const sx = rng.next() * w;
    const sy = top + rng.next() * h * 0.6;
    g.rect(sx, sy, rng.range(3, 14), rng.range(30, h * 0.5))
      .fill({ color: vl(ctx, value - 0.07), alpha: 0.26 });
  }
  const tide = ctx.num('tide', 0);
  if (tide > 0) {
    g.rect(0, -tide, w, tide).fill({ color: vl(ctx, value - 0.07), alpha: 0.75 });
    g.rect(0, -tide, w, 3.5).fill({ color: vl(ctx, value + 0.16), alpha: 0.7 });
    g.rect(0, -tide + 3.5, w, 9).fill({ color: vl(ctx, value + 0.05), alpha: 0.3 });
  }
};

/** Collapsed masonry - reads as "the town has been under water for 60 years". */
export const rubble: PropDraw = (ctx) => {
  const { g, rng } = ctx;
  const w = ctx.num('w', 160);
  const h = ctx.num('h', 46);
  // Dense enough that a rubble pile reads as broken masonry rather than
  // as a triangle, even when it is a near-foreground silhouette.
  const pts = jaggedTop(rng, 0, w, 0, h, Math.max(9, Math.round(w / 9)));
  g.poly([[0, 0], ...pts, [w, 0]].flat()).fill({ color: vl(ctx, 0.13) });
  // Individual blocks catching the ambient light.
  const blocks = Math.round(w / 12);
  for (let i = 0; i < blocks; i++) {
    const bx = rng.next() * w;
    const idx = Math.min(pts.length - 1, Math.floor((bx / w) * (pts.length - 1)));
    const surfaceY = pts[idx][1];
    const by = surfaceY + rng.range(0, Math.max(2, -surfaceY * 0.8));
    const bw = rng.range(6, 20);
    const bh = rng.range(4, 11);
    const rot = rng.signed() * 0.4;
    const cos = Math.cos(rot);
    const sin = Math.sin(rot);
    const corner = (px: number, py: number): [number, number] => [
      bx + px * cos - py * sin,
      by + px * sin + py * cos,
    ];
    const c1 = corner(0, 0);
    const c2 = corner(bw, 0);
    const c3 = corner(bw, bh);
    const c4 = corner(0, bh);
    g.poly([...c1, ...c2, ...c3, ...c4]).fill({ color: vl(ctx, 0.1 + rng.next() * 0.16) });
    g.poly([...c1, ...c2]).stroke({ width: 1, color: vl(ctx, 0.3), alpha: 0.5 });
  }
  // Protruding reinforcement bar.
  for (let i = 0; i < Math.round(w / 70); i++) {
    const bx = rng.range(w * 0.2, w * 0.8);
    g.poly([bx, -h * 0.5, bx + rng.signed() * 14, -h * 0.5 - rng.range(14, 34)])
      .stroke({ width: 2, color: vl(ctx, 0.24) });
  }
};

export const doorframe: PropDraw = (ctx) => {
  const { g } = ctx;
  const w = ctx.num('w', 42);
  const h = ctx.num('h', 76);
  const open = ctx.bool('open', false);
  const arch = ctx.bool('arch', false);
  const lit = ctx.bool('lit', ctx.layer === 'before');

  // Void behind the opening.
  g.rect(0, -h, w, h).fill({ color: vl(ctx, open && lit ? 0.4 : 0.02) });
  if (arch) g.circle(w / 2, -h, w / 2).fill({ color: vl(ctx, open && lit ? 0.4 : 0.02) });

  // Jambs and head.
  g.rect(-6, -h - (arch ? w / 2 : 0) - 6, 6, h + (arch ? w / 2 : 0) + 6)
    .fill({ color: vl(ctx, 0.22) });
  g.rect(w, -h - (arch ? w / 2 : 0) - 6, 6, h + (arch ? w / 2 : 0) + 6)
    .fill({ color: vl(ctx, 0.19) });
  if (!arch) g.rect(-6, -h - 6, w + 12, 6).fill({ color: vl(ctx, 0.26) });

  if (!open) {
    // The door itself: planks, hinges, handle.
    g.rect(0, -h, w, h).fill({ color: vl(ctx, 0.17) });
    const planks = Math.max(3, Math.round(w / 11));
    for (let i = 1; i < planks; i++) {
      g.rect((w / planks) * i - 0.7, -h, 1.4, h).fill({ color: vl(ctx, 0.11) });
    }
    g.rect(2, -h * 0.82, w - 4, 4).fill({ color: vl(ctx, 0.23) });
    g.rect(2, -h * 0.22, w - 4, 4).fill({ color: vl(ctx, 0.23) });
    g.circle(w - 9, -h * 0.48, 3).fill({ color: vl(ctx, 0.42) });
    for (const hy of [-h * 0.8, -h * 0.2]) {
      g.rect(0, hy, 11, 5).fill({ color: vl(ctx, 0.3) });
    }
  } else if (lit) {
    // Light spilling out of the doorway onto the ground.
    g.poly([0, 0, w, 0, w + 26, 30, -26, 30]).fill({ color: vl(ctx, 0.55), alpha: 0.13 });
  }
};

export const stair: PropDraw = (ctx) => {
  const { g } = ctx;
  const steps = Math.max(1, Math.round(ctx.num('steps', 6)));
  const rise = ctx.num('rise', 13);
  const run = ctx.num('run', 20);
  const dir = ctx.num('dir', 1);
  const w = ctx.num('w', 0);

  for (let i = 0; i < steps; i++) {
    const x = dir > 0 ? i * run : -(i + 1) * run;
    const y = -(i + 1) * rise;
    g.rect(x, y, run + 1, rise + 1).fill({ color: vl(ctx, 0.16) });
    // Tread highlight / riser shadow pair reads the step at a glance.
    g.rect(x, y, run + 1, 2.4).fill({ color: vl(ctx, 0.3) });
    g.rect(x, y + 2.4, run + 1, 3).fill({ color: vl(ctx, 0.08), alpha: 0.5 });
  }
  if (w > 0) {
    // Flank wall under the flight.
    const totalRun = steps * run;
    const x0 = dir > 0 ? 0 : -totalRun;
    g.poly([x0, 0, x0 + totalRun, 0, x0 + totalRun, -steps * rise, x0, 0])
      .fill({ color: vl(ctx, 0.1) });
  }
};

export const railing: PropDraw = (ctx) => {
  const { g, rng } = ctx;
  const w = ctx.num('w', 160);
  const h = ctx.num('h', 42);
  const style = ctx.str('style', 'iron');
  const broken = ctx.bool('broken', false);
  const spacing = style === 'timber' ? 34 : 17;

  // Top rail.
  g.rect(0, -h, w, style === 'timber' ? 5 : 3).fill({ color: vl(ctx, 0.25) });
  if (style === 'iron') g.rect(0, -h * 0.45, w, 2).fill({ color: vl(ctx, 0.2) });

  for (let x = 2; x < w; x += spacing) {
    if (broken && rng.chance(0.3)) continue;
    const bh = broken && rng.chance(0.25) ? h * rng.range(0.3, 0.7) : h;
    g.rect(x, -bh, style === 'timber' ? 5 : 2.4, bh).fill({ color: vl(ctx, 0.22) });
    if (style === 'iron' && rng.chance(0.3)) {
      // Decorative finial.
      g.circle(x + 1.2, -bh - 2, 2.6).fill({ color: vl(ctx, 0.26) });
    }
  }
  if (style === 'rope') {
    g.clear();
    for (let x = 2; x < w; x += 46) {
      g.rect(x, -h, 4, h).fill({ color: vl(ctx, 0.2) });
    }
    // Catenary sag between posts.
    for (let x = 2; x < w - 46; x += 46) {
      const pts: number[] = [];
      for (let i = 0; i <= 8; i++) {
        const t = i / 8;
        pts.push(x + 2 + t * 46, -h + 4 + Math.sin(t * Math.PI) * 9);
      }
      g.poly(pts).stroke({ width: 1.8, color: vl(ctx, 0.28) });
    }
  }
};
