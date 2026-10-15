import { type PropDraw, vl } from './context';

/** Survey camp, signage, wreckage and the few objects that carry the story. */

export const tent: PropDraw = (ctx) => {
  const { g, rng } = ctx;
  const w = ctx.num('w', 92);
  const h = ctx.num('h', 60);

  // Ridge tent, one guy line snapped.
  g.poly([0, 0, w, 0, w * 0.5, -h]).fill({ color: vl(ctx, 0.17) });
  g.poly([w * 0.5, -h, w, 0, w * 0.76, 0]).fill({ color: vl(ctx, 0.13) });
  // Door flap, hanging open.
  g.poly([w * 0.42, 0, w * 0.5, -h * 0.62, w * 0.6, 0]).fill({ color: vl(ctx, 0.06) });
  // Ridge highlight.
  g.poly([w * 0.5, -h, w * 0.08, -2]).stroke({ width: 1.8, color: vl(ctx, 0.3), alpha: 0.6 });
  // Guys and pegs.
  g.poly([w * 0.5, -h + 2, -16, -1]).stroke({ width: 1, color: vl(ctx, 0.24) });
  g.poly([w * 0.5, -h + 2, w + 14, -1]).stroke({ width: 1, color: vl(ctx, 0.24), alpha: 0.4 });
  for (let i = 0; i < 4; i++) {
    g.rect(rng.next() * w, -3, 2, 4).fill({ color: vl(ctx, 0.2) });
  }
};

export const tripod: PropDraw = (ctx) => {
  const { g } = ctx;
  const h = ctx.num('h', 92);
  // Three legs, one shorter to read as planted on uneven silt.
  for (const [dx, scale] of [[-20, 1], [16, 0.97], [-3, 1.02]] as const) {
    g.poly([0, -h, dx * 0.2, -h * 0.5, dx, -2])
      .stroke({ width: 3, color: vl(ctx, 0.2) });
    g.rect(dx - 1.5, -3 * scale, 3, 4).fill({ color: vl(ctx, 0.24) });
  }
  // Instrument head.
  g.rect(-13, -h - 13, 26, 14).fill({ color: vl(ctx, 0.22) });
  g.rect(-13, -h - 13, 26, 3).fill({ color: vl(ctx, 0.3) });
  g.rect(10, -h - 10, 16, 7).fill({ color: vl(ctx, 0.19) });
  g.circle(26, -h - 6.5, 4).fill({ color: vl(ctx, 0.1) });
  g.circle(26, -h - 6.5, 2.4).fill({ color: vl(ctx, 0.46), alpha: 0.7 });
};

export const boatwreck: PropDraw = (ctx) => {
  const { g, rng } = ctx;
  const w = ctx.num('w', 160);
  const h = ctx.num('h', 46);

  // Overturned hull: a long, calm curve against all the broken verticals.
  const pts: number[] = [];
  const steps = 16;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    pts.push(t * w, -Math.sin(t * Math.PI) * h);
  }
  pts.push(w, 0, 0, 0);
  g.poly(pts).fill({ color: vl(ctx, 0.14) });
  // Ribs showing through a stove-in section.
  g.poly([w * 0.52, -h * 0.72, w * 0.84, -h * 0.4, w * 0.8, -2, w * 0.5, -4])
    .fill({ color: vl(ctx, 0.05) });
  for (let i = 0; i < 5; i++) {
    const t = 0.54 + i * 0.058;
    g.poly([t * w, -Math.sin(t * Math.PI) * h * 0.95, t * w + 3, -2])
      .stroke({ width: 2.2, color: vl(ctx, 0.17) });
  }
  // Keel highlight.
  const hi: number[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    hi.push(t * w, -Math.sin(t * Math.PI) * h + 2);
  }
  g.poly(hi).stroke({ width: 1.6, color: vl(ctx, 0.28), alpha: 0.5 });
  for (let i = 0; i < 6; i++) {
    g.rect(rng.next() * w, -rng.range(2, 8), rng.range(4, 14), 2)
      .fill({ color: vl(ctx, 0.19), alpha: 0.6 });
  }
};

export const sign: PropDraw = (ctx) => {
  const { g } = ctx;
  const w = ctx.num('w', 86);
  const h = ctx.num('h', 34);
  const postH = ctx.num('postH', 54);
  const style = ctx.str('style', 'warning');

  if (postH > 0) {
    g.rect(w * 0.5 - 3, -postH, 6, postH).fill({ color: vl(ctx, 0.18) });
    g.rect(w * 0.5 - 3, -postH, 2, postH).fill({ color: vl(ctx, 0.24) });
  }
  const top = -postH - h;
  g.rect(0, top, w, h).fill({ color: vl(ctx, style === 'warning' ? 0.3 : 0.15) });
  g.rect(0, top, w, 2).fill({ color: vl(ctx, 0.4) });
  g.rect(0, top, w, h).stroke({ width: 2, color: vl(ctx, 0.1) });
  // Lettering suggested as blocks: readable as text without needing a font.
  const lines = Math.max(1, Math.round(ctx.num('lines', 2)));
  for (let l = 0; l < lines; l++) {
    const ly = top + h * ((l + 0.5) / lines) - 2.5;
    const lw = w * (l === 0 ? 0.7 : 0.52);
    g.rect(w * 0.5 - lw / 2, ly, lw, 4.5).fill({ color: vl(ctx, 0.08) });
  }
  if (style === 'warning') {
    // Bolt holes and a bullet hole, because of course.
    g.circle(5, top + 5, 1.8).fill({ color: vl(ctx, 0.08) });
    g.circle(w - 5, top + 5, 1.8).fill({ color: vl(ctx, 0.08) });
  }
};

/** Floor-standing survey lamp - where the lantern is found. */
export const surveylamp: PropDraw = (ctx) => {
  const { g } = ctx;
  const h = ctx.num('h', 52);
  const lit = ctx.bool('lit', false);

  // Tripod base.
  for (const dx of [-15, 15, 0]) {
    g.poly([0, -h * 0.5, dx, -2]).stroke({ width: 2.6, color: vl(ctx, 0.19) });
  }
  g.rect(-3, -h * 0.72, 6, h * 0.3).fill({ color: vl(ctx, 0.2) });
  // Housing: a squat brass drum with a fresnel face.
  g.rect(-14, -h, 28, h * 0.32).fill({ color: vl(ctx, 0.24) });
  g.rect(-14, -h, 28, 3).fill({ color: vl(ctx, 0.34) });
  g.circle(0, -h + h * 0.16, h * 0.13).fill({ color: vl(ctx, lit ? 0.95 : 0.09) });
  for (let i = 0; i < 3; i++) {
    g.circle(0, -h + h * 0.16, h * 0.13 - i * 2)
      .stroke({ width: 0.9, color: vl(ctx, lit ? 0.6 : 0.16), alpha: 0.7 });
  }
  // Carry handle.
  g.poly([-9, -h, -9, -h - 9, 9, -h - 9, 9, -h])
    .stroke({ width: 2.4, color: vl(ctx, 0.27) });
};

/** Wall-mounted clock. Three of these are the gatehouse puzzle's clue. */
export const clockface: PropDraw = (ctx) => {
  const { g } = ctx;
  const r = ctx.num('r', 22);
  const hour = ctx.num('hour', 3);
  const minute = ctx.num('minute', 0);
  const stopped = ctx.bool('stopped', true);

  g.circle(0, 0, r + 4).fill({ color: vl(ctx, 0.19) });
  g.circle(0, 0, r + 4).stroke({ width: 2, color: vl(ctx, 0.26) });
  g.circle(0, 0, r).fill({ color: vl(ctx, stopped ? 0.34 : 0.44) });
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const inner = i % 3 === 0 ? r * 0.74 : r * 0.85;
    g.poly([Math.cos(a) * inner, Math.sin(a) * inner, Math.cos(a) * (r - 2), Math.sin(a) * (r - 2)])
      .stroke({ width: i % 3 === 0 ? 2 : 1, color: vl(ctx, 0.08) });
  }
  const ha = ((hour % 12) / 12) * Math.PI * 2 - Math.PI / 2 + (minute / 60) * (Math.PI / 6);
  const ma = (minute / 60) * Math.PI * 2 - Math.PI / 2;
  g.poly([0, 0, Math.cos(ha) * r * 0.5, Math.sin(ha) * r * 0.5])
    .stroke({ width: 3, color: vl(ctx, 0.06) });
  g.poly([0, 0, Math.cos(ma) * r * 0.78, Math.sin(ma) * r * 0.78])
    .stroke({ width: 2, color: vl(ctx, 0.06) });
  g.circle(0, 0, 2.2).fill({ color: vl(ctx, 0.1) });
  // Cracked crystal: this clock stopped when the water reached it.
  if (stopped) {
    g.poly([-r * 0.7, -r * 0.5, r * 0.2, r * 0.3, r * 0.75, r * 0.1])
      .stroke({ width: 1, color: vl(ctx, 0.62), alpha: 0.45 });
  }
};

/** A pinned-up document: the gate log, a notice, a photograph. */
export const paper: PropDraw = (ctx) => {
  const { g, rng } = ctx;
  const w = ctx.num('w', 30);
  const h = ctx.num('h', 40);
  const lines = Math.max(2, Math.round(ctx.num('lines', 6)));
  const curl = ctx.num('curl', 4);

  g.poly([0, -h, w, -h, w - curl, 0, curl * 0.4, 0]).fill({ color: vl(ctx, 0.56) });
  g.poly([0, -h, w, -h, w, -h + 2, 0, -h + 2]).fill({ color: vl(ctx, 0.68) });
  // Water staining from the bottom edge up.
  g.rect(0, -h * 0.4, w, h * 0.4).fill({ color: vl(ctx, 0.38), alpha: 0.55 });
  for (let i = 0; i < lines; i++) {
    const ly = -h + 6 + i * ((h - 10) / lines);
    const lw = w * rng.range(0.45, 0.86);
    g.rect(3, ly, lw, 1.6).fill({ color: vl(ctx, 0.2), alpha: 0.8 });
  }
  // Drawing pin.
  g.circle(w * 0.5, -h + 2, 2.2).fill({ color: vl(ctx, 0.3) });
};

/** Child's doll or shoe left in the silt - one, used once, not a motif. */
export const smallobject: PropDraw = (ctx) => {
  const { g } = ctx;
  const style = ctx.str('style', 'shoe');
  const s = ctx.num('s', 1);

  if (style === 'shoe') {
    g.poly([0, 0, 22 * s, 0, 20 * s, -7 * s, 11 * s, -9 * s, 4 * s, -14 * s, 0, -12 * s])
      .fill({ color: vl(ctx, 0.15) });
    g.poly([0, -12 * s, 4 * s, -14 * s, 11 * s, -9 * s])
      .stroke({ width: 1.2, color: vl(ctx, 0.26) });
    g.rect(0, -2 * s, 22 * s, 2 * s).fill({ color: vl(ctx, 0.22) });
  } else if (style === 'satchel') {
    g.rect(0, -16 * s, 24 * s, 16 * s).fill({ color: vl(ctx, 0.16) });
    g.rect(0, -16 * s, 24 * s, 6 * s).fill({ color: vl(ctx, 0.2) });
    g.rect(9 * s, -11 * s, 6 * s, 4 * s).fill({ color: vl(ctx, 0.3) });
    g.poly([2 * s, -16 * s, 6 * s, -30 * s, 20 * s, -30 * s, 22 * s, -16 * s])
      .stroke({ width: 2, color: vl(ctx, 0.18) });
  } else {
    // 'cup' - an enamel mug, the kind the gate crew drank from
    g.rect(0, -13 * s, 16 * s, 13 * s).fill({ color: vl(ctx, 0.3) });
    g.rect(0, -13 * s, 16 * s, 2.4 * s).fill({ color: vl(ctx, 0.42) });
    g.circle(20 * s, -7 * s, 5 * s).stroke({ width: 2.4, color: vl(ctx, 0.3) });
  }
};

/** Ground detail strip: cobbles, floorboards, grating. */
export const groundstrip: PropDraw = (ctx) => {
  const { g, rng } = ctx;
  const w = ctx.num('w', 400);
  const style = ctx.str('style', 'cobble');
  const value = ctx.num('value', 0.13);

  if (style === 'cobble') {
    g.rect(0, 0, w, 16).fill({ color: vl(ctx, value) });
    let x = 0;
    while (x < w) {
      const cw = rng.range(7, 15);
      const sunken = rng.chance(0.25);
      g.poly([x, 1, x + cw, 1, x + cw - 1.5, 7, x + 1.5, 7])
        .fill({ color: vl(ctx, value + (sunken ? -0.04 : rng.range(0.02, 0.1))) });
      if (!sunken) {
        g.rect(x + 1, 1, cw - 2, 1.4).fill({ color: vl(ctx, value + 0.14), alpha: 0.5 });
      }
      x += cw + rng.range(0.6, 2);
    }
  } else if (style === 'boards') {
    g.rect(0, 0, w, 12).fill({ color: vl(ctx, value) });
    for (let x = 0; x < w; x += 46) {
      g.rect(x, 0, 1.6, 12).fill({ color: vl(ctx, value - 0.06) });
    }
    g.rect(0, 0, w, 1.8).fill({ color: vl(ctx, value + 0.13), alpha: 0.65 });
    // A few boards sprung by the water.
    for (let i = 0; i < Math.round(w / 180); i++) {
      const bx = rng.next() * w;
      g.poly([bx, 0, bx + 40, -rng.range(3, 9), bx + 40, -rng.range(1, 6), bx, 2])
        .fill({ color: vl(ctx, value + 0.05) });
    }
  } else {
    // grating
    g.rect(0, 0, w, 10).fill({ color: vl(ctx, value - 0.04) });
    for (let x = 0; x < w; x += 9) {
      g.rect(x, 0, 4.5, 10).fill({ color: vl(ctx, value + 0.07) });
      g.rect(x, 0, 4.5, 1.6).fill({ color: vl(ctx, value + 0.16) });
    }
  }
};
