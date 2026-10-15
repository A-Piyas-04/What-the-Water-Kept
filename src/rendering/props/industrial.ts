import { type PropDraw, vl } from './context';

/** Mill, tunnel and gatehouse machinery. */

export const girder: PropDraw = (ctx) => {
  const { g, rng } = ctx;
  const w = ctx.num('w', 220);
  const h = ctx.num('h', 26);
  const style = ctx.str('style', 'beam');
  const vertical = ctx.bool('vertical', false);

  if (style === 'truss') {
    const top = -h;
    g.rect(0, top, w, 4).fill({ color: vl(ctx, 0.2) });
    g.rect(0, -4, w, 4).fill({ color: vl(ctx, 0.17) });
    const bays = Math.max(2, Math.round(w / 34));
    for (let i = 0; i <= bays; i++) {
      const x = (i / bays) * w;
      g.rect(x - 1.4, top, 2.8, h).fill({ color: vl(ctx, 0.19) });
      if (i < bays) {
        const x2 = ((i + 1) / bays) * w;
        g.poly([x, -4, x2, top + 4]).stroke({ width: 2.6, color: vl(ctx, 0.18) });
      }
    }
  } else if (vertical) {
    g.rect(0, -w, h, w).fill({ color: vl(ctx, 0.17) });
    g.rect(h * 0.36, -w, h * 0.28, w).fill({ color: vl(ctx, 0.13) });
    g.rect(0, -w, 2.4, w).fill({ color: vl(ctx, 0.25) });
    for (let y = -w + 16; y < -10; y += 42) {
      g.rect(-2, y, h + 4, 5).fill({ color: vl(ctx, 0.2) });
      for (const bx of [1, h - 4]) g.circle(bx + 1.5, y + 2.5, 1.5).fill({ color: vl(ctx, 0.3) });
    }
  } else {
    // I-beam read in side elevation: flange, web, flange.
    g.rect(0, -h, w, 4.5).fill({ color: vl(ctx, 0.23) });
    g.rect(0, -h * 0.62, w, h * 0.3).fill({ color: vl(ctx, 0.14) });
    g.rect(0, -4.5, w, 4.5).fill({ color: vl(ctx, 0.19) });
    // Rivet lines.
    for (let x = 8; x < w; x += 22) {
      g.circle(x, -h + 2.2, 1.6).fill({ color: vl(ctx, 0.28) });
      g.circle(x, -2.2, 1.6).fill({ color: vl(ctx, 0.24) });
    }
    // Rust bleeding downward.
    for (let i = 0; i < Math.round(w / 40); i++) {
      const sx = rng.next() * w;
      g.rect(sx, -2, rng.range(2, 6), rng.range(8, 26))
        .fill({ color: vl(ctx, 0.2), alpha: 0.22 });
    }
  }
};

export const piperun: PropDraw = (ctx) => {
  const { g, rng } = ctx;
  const len = ctx.num('len', 240);
  const r = ctx.num('r', 11);
  const vertical = ctx.bool('vertical', false);
  const value = ctx.num('value', 0.17);

  if (vertical) {
    g.rect(0, -len, r * 2, len).fill({ color: vl(ctx, value) });
    g.rect(r * 0.25, -len, r * 0.7, len).fill({ color: vl(ctx, value + 0.1), alpha: 0.6 });
    g.rect(r * 1.6, -len, r * 0.4, len).fill({ color: vl(ctx, value - 0.06), alpha: 0.7 });
    for (let y = -len + 20; y < -8; y += 70) {
      g.rect(-3, y, r * 2 + 6, 8).fill({ color: vl(ctx, value + 0.05) });
      g.rect(-3, y, r * 2 + 6, 2).fill({ color: vl(ctx, value + 0.13) });
    }
  } else {
    g.rect(0, -r * 2, len, r * 2).fill({ color: vl(ctx, value) });
    // Cylindrical shading: highlight band above centre, core shadow below.
    g.rect(0, -r * 1.75, len, r * 0.7).fill({ color: vl(ctx, value + 0.11), alpha: 0.65 });
    g.rect(0, -r * 0.4, len, r * 0.4).fill({ color: vl(ctx, value - 0.07), alpha: 0.75 });
    // Flanged joints.
    for (let x = 0; x < len; x += ctx.num('joint', 84)) {
      g.rect(x - 2, -r * 2 - 3, 7, r * 2 + 6).fill({ color: vl(ctx, value + 0.06) });
      g.rect(x - 2, -r * 2 - 3, 7, 2).fill({ color: vl(ctx, value + 0.14) });
    }
    // Brackets back to the wall.
    if (ctx.bool('brackets', true)) {
      for (let x = 30; x < len; x += 120) {
        g.rect(x, -r * 2 - 14, 5, 14).fill({ color: vl(ctx, value + 0.02) });
      }
    }
    for (let i = 0; i < Math.round(len / 50); i++) {
      const sx = rng.next() * len;
      g.rect(sx, -r * 0.3, rng.range(3, 9), rng.range(6, 20))
        .fill({ color: vl(ctx, value + 0.08), alpha: 0.2 });
    }
  }
};

export const rails: PropDraw = (ctx) => {
  const { g, rng } = ctx;
  const w = ctx.num('w', 400);
  const gauge = ctx.num('gauge', 34);
  const sleeperEvery = 26;

  for (let x = 0; x < w; x += sleeperEvery) {
    g.rect(x, -3, 16, 6).fill({ color: vl(ctx, 0.11 + rng.next() * 0.04) });
  }
  // Two rails: the near one brighter, so the track reads in the dark.
  g.rect(0, -6, w, 3).fill({ color: vl(ctx, 0.34) });
  g.rect(0, -6, w, 1).fill({ color: vl(ctx, 0.5), alpha: 0.7 });
  g.rect(0, -6 - gauge * 0.18, w, 2.4).fill({ color: vl(ctx, 0.24) });
  g.rect(0, -6 - gauge * 0.18, w, 1).fill({ color: vl(ctx, 0.36), alpha: 0.6 });
};

export const minecart: PropDraw = (ctx) => {
  const { g } = ctx;
  const w = ctx.num('w', 70);
  const h = ctx.num('h', 46);
  const loaded = ctx.bool('loaded', false);

  // Wheels first, so the body overlaps them.
  for (const wx of [w * 0.22, w * 0.78]) {
    g.circle(wx, -9, 9).fill({ color: vl(ctx, 0.19) });
    g.circle(wx, -9, 5).fill({ color: vl(ctx, 0.12) });
    g.circle(wx, -9, 2).fill({ color: vl(ctx, 0.3) });
  }
  // Body: slightly flared skip.
  g.poly([2, -16, w - 2, -16, w - 7, -h, 7, -h]).fill({ color: vl(ctx, 0.18) });
  g.poly([2, -16, w - 2, -16, w - 2, -14, 2, -14]).fill({ color: vl(ctx, 0.24) });
  // Vertical staves.
  for (let i = 1; i < 6; i++) {
    const t = i / 6;
    g.rect(7 + (w - 14) * t, -h, 2, h - 16).fill({ color: vl(ctx, 0.13) });
  }
  // Rim highlight.
  g.rect(6, -h, w - 12, 2.6).fill({ color: vl(ctx, 0.33) });
  if (loaded) {
    g.poly([9, -h, w - 9, -h, w - 16, -h - 11, 16, -h - 9]).fill({ color: vl(ctx, 0.14) });
  }
  // Coupling hook.
  g.rect(-6, -22, 8, 4).fill({ color: vl(ctx, 0.26) });
};

export const winch: PropDraw = (ctx) => {
  const { g } = ctx;
  const w = ctx.num('w', 64);
  const h = ctx.num('h', 72);
  // Frame.
  g.rect(0, -h, 9, h).fill({ color: vl(ctx, 0.18) });
  g.rect(w - 9, -h, 9, h).fill({ color: vl(ctx, 0.15) });
  g.rect(-3, -h - 8, w + 6, 9).fill({ color: vl(ctx, 0.21) });
  // Drum with wound cable.
  g.circle(w / 2, -h * 0.62, w * 0.3).fill({ color: vl(ctx, 0.2) });
  for (let i = 0; i < 7; i++) {
    g.circle(w / 2, -h * 0.62, w * 0.3 - i * 2.2)
      .stroke({ width: 1, color: vl(ctx, 0.14), alpha: 0.7 });
  }
  g.circle(w / 2, -h * 0.62, 4).fill({ color: vl(ctx, 0.33) });
  // Crank handle.
  g.rect(w - 9, -h * 0.64, 16, 3).fill({ color: vl(ctx, 0.28) });
  g.rect(w + 5, -h * 0.64 - 9, 3, 12).fill({ color: vl(ctx, 0.3) });
  // Base plate.
  g.rect(-5, -5, w + 10, 6).fill({ color: vl(ctx, 0.16) });
};

/** Hanging counterweight on a cable - the tunnels puzzle centrepiece. */
export const counterweight: PropDraw = (ctx) => {
  const { g } = ctx;
  const w = ctx.num('w', 34);
  const h = ctx.num('h', 54);
  const cable = ctx.num('cable', 120);

  g.rect(w / 2 - 1, -h - cable, 2, cable).fill({ color: vl(ctx, 0.26) });
  g.rect(0, -h, w, h).fill({ color: vl(ctx, 0.2) });
  g.rect(0, -h, w, 3).fill({ color: vl(ctx, 0.31) });
  g.rect(0, -h * 0.52, w, 4).fill({ color: vl(ctx, 0.12) });
  g.rect(w * 0.2, -h - 7, w * 0.6, 8).fill({ color: vl(ctx, 0.24) });
  g.circle(w / 2, -h - 7, 4).stroke({ width: 2, color: vl(ctx, 0.3) });
};

export const valve: PropDraw = (ctx) => {
  const { g } = ctx;
  const r = ctx.num('r', 20);
  const spokes = Math.max(3, Math.round(ctx.num('spokes', 5)));
  const angle = ctx.num('angle', 0);

  g.circle(0, 0, r * 0.3).fill({ color: vl(ctx, 0.22) });
  g.circle(0, 0, r).stroke({ width: r * 0.22, color: vl(ctx, 0.24) });
  for (let i = 0; i < spokes; i++) {
    const a = angle + (i / spokes) * Math.PI * 2;
    g.poly([0, 0, Math.cos(a) * r, Math.sin(a) * r])
      .stroke({ width: r * 0.14, color: vl(ctx, 0.26) });
  }
  g.circle(0, 0, r * 0.16).fill({ color: vl(ctx, 0.36) });
};

/** Big slow-turning machinery: turbine housing, mill gearing. */
export const machine: PropDraw = (ctx) => {
  const { g, rng } = ctx;
  const w = ctx.num('w', 160);
  const h = ctx.num('h', 120);

  g.rect(0, -h, w, h).fill({ color: vl(ctx, 0.15) });
  g.rect(0, -h, w, 4).fill({ color: vl(ctx, 0.23) });
  g.rect(0, -h, w * 0.26, h).fill({ color: vl(ctx, 0.18), alpha: 0.6 });
  // Inspection hatch.
  const hw = w * 0.38;
  const hh = h * 0.42;
  g.rect(w * 0.12, -h * 0.78, hw, hh).fill({ color: vl(ctx, 0.11) });
  g.rect(w * 0.12, -h * 0.78, hw, 2).fill({ color: vl(ctx, 0.22) });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    g.circle(w * 0.12 + hw / 2 + Math.cos(a) * (hw / 2 - 5), -h * 0.78 + hh / 2 + Math.sin(a) * (hh / 2 - 5), 1.8)
      .fill({ color: vl(ctx, 0.27) });
  }
  // Exposed gear wheel.
  const gx = w * 0.74;
  const gy = -h * 0.54;
  const gr = Math.min(w, h) * 0.22;
  g.circle(gx, gy, gr).fill({ color: vl(ctx, 0.19) });
  const teeth = 14;
  for (let i = 0; i < teeth; i++) {
    const a = (i / teeth) * Math.PI * 2;
    g.rect(gx + Math.cos(a) * gr - 2.4, gy + Math.sin(a) * gr - 2.4, 4.8, 4.8)
      .fill({ color: vl(ctx, 0.21) });
  }
  g.circle(gx, gy, gr * 0.3).fill({ color: vl(ctx, 0.12) });
  g.circle(gx, gy, gr * 0.12).fill({ color: vl(ctx, 0.3) });
  // Feet and conduit.
  g.rect(-6, -10, w + 12, 11).fill({ color: vl(ctx, 0.17) });
  for (let i = 0; i < Math.round(w / 55); i++) {
    const sx = rng.next() * w;
    g.rect(sx, -h + 6, rng.range(3, 7), rng.range(14, h * 0.5))
      .fill({ color: vl(ctx, 0.2), alpha: 0.18 });
  }
};

/** The gatehouse control console: slate desk, three dials, gauges, levers. */
export const controldesk: PropDraw = (ctx) => {
  const { g } = ctx;
  const w = ctx.num('w', 220);
  const h = ctx.num('h', 54);
  const backH = ctx.num('backH', 78);

  // Sloped desk top.
  g.poly([0, -h, w, -h, w, -h + 7, 0, -h + 7]).fill({ color: vl(ctx, 0.23) });
  g.rect(0, -h + 7, w, h - 7).fill({ color: vl(ctx, 0.15) });
  g.rect(0, -h, w, 2).fill({ color: vl(ctx, 0.3) });
  // Back panel carrying the instruments.
  g.rect(w * 0.06, -h - backH, w * 0.88, backH).fill({ color: vl(ctx, 0.17) });
  g.rect(w * 0.06, -h - backH, w * 0.88, 3).fill({ color: vl(ctx, 0.26) });
  g.rect(w * 0.06, -h - backH, 3, backH).fill({ color: vl(ctx, 0.22) });
  // Gauge faces.
  for (let i = 0; i < 4; i++) {
    const gx = w * 0.14 + i * (w * 0.2);
    const gy = -h - backH * 0.62;
    g.circle(gx, gy, 11).fill({ color: vl(ctx, 0.08) });
    g.circle(gx, gy, 11).stroke({ width: 2, color: vl(ctx, 0.27) });
    g.circle(gx, gy, 8.4).fill({ color: vl(ctx, 0.3), alpha: 0.5 });
    const a = -2.1 + i * 0.7;
    g.poly([gx, gy, gx + Math.cos(a) * 7, gy + Math.sin(a) * 7])
      .stroke({ width: 1.6, color: vl(ctx, 0.05) });
  }
  // Toggle bank.
  for (let i = 0; i < 6; i++) {
    const tx = w * 0.12 + i * (w * 0.13);
    g.rect(tx, -h - 12, 9, 9).fill({ color: vl(ctx, 0.1) });
    g.rect(tx + 3, -h - 18, 3, 8).fill({ color: vl(ctx, 0.29) });
  }
  // Kneehole shadow.
  g.rect(w * 0.18, -h + 10, w * 0.64, h - 14).fill({ color: vl(ctx, 0.07) });
};

/** A single large sluice dial, drawn by the puzzle layer at a given angle. */
export const dialface: PropDraw = (ctx) => {
  const { g } = ctx;
  const r = ctx.num('r', 30);
  const marks = Math.max(3, Math.round(ctx.num('marks', 8)));

  g.circle(0, 0, r + 6).fill({ color: vl(ctx, 0.14) });
  g.circle(0, 0, r + 6).stroke({ width: 2.5, color: vl(ctx, 0.25) });
  g.circle(0, 0, r).fill({ color: vl(ctx, 0.09) });
  for (let i = 0; i < marks; i++) {
    const a = (i / marks) * Math.PI * 2 - Math.PI / 2;
    const inner = i % 2 === 0 ? r * 0.76 : r * 0.86;
    g.poly([
      Math.cos(a) * inner, Math.sin(a) * inner,
      Math.cos(a) * (r - 3), Math.sin(a) * (r - 3),
    ]).stroke({ width: i % 2 === 0 ? 2.4 : 1.2, color: vl(ctx, 0.34) });
  }
  g.circle(0, 0, r * 0.14).fill({ color: vl(ctx, 0.3) });
};

export const sluicegate: PropDraw = (ctx) => {
  const { g, rng } = ctx;
  const w = ctx.num('w', 240);
  const h = ctx.num('h', 300);
  const lift = ctx.num('lift', 0);
  const top = -h;

  // Gate recess in the concrete.
  g.rect(-14, top - 10, w + 28, h + 10).fill({ color: vl(ctx, 0.05) });
  // The gate leaf, raised by `lift`.
  const gy = top + lift;
  g.rect(0, gy, w, h).fill({ color: vl(ctx, 0.16) });
  // Horizontal stiffeners.
  for (let y = gy; y < gy + h; y += 38) {
    g.rect(0, y, w, 7).fill({ color: vl(ctx, 0.2) });
    g.rect(0, y, w, 2).fill({ color: vl(ctx, 0.27) });
    for (let x = 10; x < w; x += 30) g.circle(x, y + 3.5, 2).fill({ color: vl(ctx, 0.26) });
  }
  // Vertical ribs.
  for (let x = 0; x < w; x += 54) {
    g.rect(x, gy, 10, h).fill({ color: vl(ctx, 0.18) });
    g.rect(x, gy, 3, h).fill({ color: vl(ctx, 0.24) });
  }
  // Lifting lugs and screw stems climbing out of frame.
  for (const lx of [w * 0.2, w * 0.8]) {
    g.rect(lx - 7, gy - 16, 14, 18).fill({ color: vl(ctx, 0.22) });
    g.rect(lx - 3, top - 240, 6, 240 + lift).fill({ color: vl(ctx, 0.2) });
    for (let y = top - 236; y < gy - 14; y += 9) {
      g.rect(lx - 5, y, 10, 2.6).fill({ color: vl(ctx, 0.25) });
    }
  }
  // Weeping seals.
  for (let i = 0; i < Math.round(w / 18); i++) {
    const sx = rng.next() * w;
    g.rect(sx, gy + h * rng.range(0.1, 0.7), rng.range(2, 6), rng.range(20, 80))
      .fill({ color: vl(ctx, 0.3), alpha: 0.14 });
  }
};
