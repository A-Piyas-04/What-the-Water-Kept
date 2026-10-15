import { Texture } from 'pixi.js';
import { Rng } from '@/core/rng';

/**
 * Every texture in the game is generated at runtime from a 2D canvas.
 *
 * This is a deliberate art-production decision: the game ships with no binary
 * image assets at all, which means nothing can fail to load, the APK stays
 * small, and the whole visual system is offline by construction.
 */

const cache = new Map<string, Texture>();

const makeCanvas = (w: number, h: number): HTMLCanvasElement => {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
};

const toTexture = (key: string, canvas: HTMLCanvasElement): Texture => {
  const tex = Texture.from(canvas);
  cache.set(key, tex);
  return tex;
};

const cached = (key: string, build: () => HTMLCanvasElement): Texture => {
  const hit = cache.get(key);
  if (hit) return hit;
  return toTexture(key, build());
};

export const hex = (color: number, alpha = 1): string => {
  const r = (color >> 16) & 0xff;
  const g = (color >> 8) & 0xff;
  const b = color & 0xff;
  return `rgba(${r},${g},${b},${alpha})`;
};

/** Radial falloff sprite used for every point light and glow. */
export const radialGlowTexture = (size = 256, falloff = 2.2): Texture =>
  cached(`glow:${size}:${falloff}`, () => {
    const c = makeCanvas(size, size);
    const ctx = c.getContext('2d')!;
    const img = ctx.createImageData(size, size);
    const half = size / 2;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = (x - half) / half;
        const dy = (y - half) / half;
        const d = Math.sqrt(dx * dx + dy * dy);
        const v = Math.max(0, 1 - d);
        const a = Math.pow(v, falloff);
        const i = (y * size + x) * 4;
        img.data[i] = 255;
        img.data[i + 1] = 255;
        img.data[i + 2] = 255;
        img.data[i + 3] = Math.round(a * 255);
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  });

/**
 * The lantern beam: a soft cone pointing +X, with the apex at the left edge
 * vertical centre. Used both as a light sprite and as the Before-layer mask.
 */
export const beamTexture = (
  w = 512,
  h = 512,
  spreadRad = 0.52,
  softness = 0.55,
): Texture =>
  cached(`beam:${w}:${h}:${spreadRad.toFixed(3)}:${softness}`, () => {
    const c = makeCanvas(w, h);
    const ctx = c.getContext('2d')!;
    const img = ctx.createImageData(w, h);
    const cy = h / 2;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const dx = x;
        const dy = y - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const t = dist / w;
        // Angular falloff from the cone axis.
        const ang = Math.abs(Math.atan2(dy, Math.max(dx, 0.0001)));
        const angT = ang / spreadRad;
        let a = 1;
        a *= Math.max(0, 1 - Math.pow(angT, 1 + softness * 3));
        // Radial falloff, with a bright near-field pool at the apex.
        a *= Math.max(0, 1 - t) ** 1.35;
        a += Math.max(0, 1 - dist / (w * 0.14)) ** 3 * 0.85;
        a = Math.min(1, a);
        const i = (y * w + x) * 4;
        img.data[i] = 255;
        img.data[i + 1] = 255;
        img.data[i + 2] = 255;
        img.data[i + 3] = Math.round(Math.max(0, a) * 255);
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  });

/**
 * The mask that cuts the window into 1964.
 *
 * A Sprite mask multiplies by its alpha, so this texture must be essentially
 * OPAQUE across the whole cone with only a feathered rim. An earlier version
 * reused the soft lighting falloff here, which meant the revealed past was
 * drawn at partial opacity everywhere except the very centre of the beam -
 * bright things like lit windows still read, but a furnished room came out as
 * a dim haze. The light and the reveal need different curves: the light is
 * soft, the window is a window.
 */
export const beamMaskTexture = (w = 512, h = 512, spreadRad = 0.52): Texture =>
  cached(`beammask:${w}:${h}:${spreadRad.toFixed(3)}`, () => {
    const c = makeCanvas(w, h);
    const ctx = c.getContext('2d')!;
    const img = ctx.createImageData(w, h);
    const cy = h / 2;
    /** Fraction of the half-angle that is fully opaque. */
    const solidAngle = spreadRad * 0.84;
    /** Fraction of the reach that is fully opaque. */
    const solidReach = 0.82;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const dx = x;
        const dy = y - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const ang = Math.abs(Math.atan2(dy, Math.max(dx, 0.0001)));

        let a = ang <= solidAngle ? 1 : 1 - (ang - solidAngle) / (spreadRad - solidAngle);
        const t = dist / w;
        const radial = t <= solidReach ? 1 : 1 - (t - solidReach) / (1 - solidReach);
        a = Math.min(a, radial);
        // The near-field pool: what she is standing on is always revealed.
        a = Math.max(a, Math.max(0, 1 - dist / (w * 0.2)));
        a = Math.max(0, Math.min(1, a));

        const i = (y * w + x) * 4;
        img.data[i] = 255;
        img.data[i + 1] = 255;
        img.data[i + 2] = 255;
        img.data[i + 3] = Math.round(a * 255);
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  });

/** Soft vertical gradient, 1px wide, stretched by the caller. */
export const verticalGradient = (
  key: string,
  stops: readonly [number, number, number][],
  height = 256,
): Texture =>
  cached(`vgrad:${key}:${height}`, () => {
    const c = makeCanvas(2, height);
    const ctx = c.getContext('2d')!;
    const g = ctx.createLinearGradient(0, 0, 0, height);
    for (const [pos, color, alpha] of stops) g.addColorStop(pos, hex(color, alpha));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 2, height);
    return c;
  });

/** Fine-grained film grain, tiled and scrolled over the whole frame. */
export const grainTexture = (size = 128, seed = 7): Texture =>
  cached(`grain:${size}:${seed}`, () => {
    const c = makeCanvas(size, size);
    const ctx = c.getContext('2d')!;
    const img = ctx.createImageData(size, size);
    const rng = new Rng(seed);
    for (let i = 0; i < size * size; i++) {
      const v = rng.next();
      const g = 128 + (v - 0.5) * 255;
      const o = i * 4;
      img.data[o] = g;
      img.data[o + 1] = g;
      img.data[o + 2] = g;
      img.data[o + 3] = 36;
    }
    ctx.putImageData(img, 0, 0);
    return c;
  });

/**
 * Procedural surface texture - damp plaster, silt, rusted iron, old wood.
 * Returns a tileable canvas built from layered value noise and streaking.
 */
export type SurfaceKind = 'plaster' | 'silt' | 'iron' | 'wood' | 'stone' | 'water';

export const surfaceTexture = (
  kind: SurfaceKind,
  base: number,
  size = 192,
  seed = 11,
): Texture =>
  cached(`surf:${kind}:${base}:${size}:${seed}`, () => {
    const c = makeCanvas(size, size);
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = hex(base, 1);
    ctx.fillRect(0, 0, size, size);
    const rng = new Rng(seed);

    const br = (base >> 16) & 0xff;
    const bg = (base >> 8) & 0xff;
    const bb = base & 0xff;
    const shade = (amount: number, alpha: number): string => {
      const r = Math.max(0, Math.min(255, br + amount));
      const g = Math.max(0, Math.min(255, bg + amount));
      const b = Math.max(0, Math.min(255, bb + amount));
      return `rgba(${r | 0},${g | 0},${b | 0},${alpha})`;
    };

    if (kind === 'plaster' || kind === 'stone') {
      for (let i = 0; i < size * 3; i++) {
        const x = rng.next() * size;
        const y = rng.next() * size;
        const r = rng.range(2, kind === 'stone' ? 26 : 13);
        ctx.fillStyle = shade(rng.signed() * 22, 0.05);
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      // Damp staining running downward.
      for (let i = 0; i < 18; i++) {
        const x = rng.next() * size;
        const w = rng.range(4, 26);
        const g = ctx.createLinearGradient(0, 0, 0, size);
        g.addColorStop(0, shade(-30, 0.16));
        g.addColorStop(1, shade(-30, 0));
        ctx.fillStyle = g;
        ctx.fillRect(x, 0, w, size);
      }
    } else if (kind === 'silt') {
      for (let i = 0; i < size * 6; i++) {
        const x = rng.next() * size;
        const y = rng.next() * size;
        ctx.fillStyle = shade(rng.signed() * 26, 0.09);
        ctx.fillRect(x, y, rng.range(1, 4), rng.range(1, 3));
      }
      for (let i = 0; i < 26; i++) {
        ctx.strokeStyle = shade(-18, 0.1);
        ctx.lineWidth = rng.range(0.6, 2.2);
        ctx.beginPath();
        const y = rng.next() * size;
        ctx.moveTo(0, y);
        ctx.bezierCurveTo(size * 0.3, y + rng.signed() * 12, size * 0.6, y + rng.signed() * 12, size, y + rng.signed() * 8);
        ctx.stroke();
      }
    } else if (kind === 'iron') {
      for (let i = 0; i < size * 4; i++) {
        const x = rng.next() * size;
        const y = rng.next() * size;
        const warm = rng.chance(0.4);
        ctx.fillStyle = warm
          ? `rgba(${Math.min(255, br + 54)},${Math.max(0, bg + 8)},${Math.max(0, bb - 18)},0.1)`
          : shade(rng.signed() * 20, 0.08);
        ctx.beginPath();
        ctx.arc(x, y, rng.range(1, 9), 0, Math.PI * 2);
        ctx.fill();
      }
      for (let i = 0; i < 10; i++) {
        ctx.fillStyle = shade(-26, 0.14);
        ctx.fillRect(0, rng.next() * size, size, rng.range(0.8, 2.4));
      }
    } else if (kind === 'wood') {
      for (let i = 0; i < 46; i++) {
        const y = (i / 46) * size + rng.signed() * 2;
        ctx.strokeStyle = shade(rng.signed() * 24, 0.16);
        ctx.lineWidth = rng.range(0.5, 2.6);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.bezierCurveTo(size * 0.33, y + rng.signed() * 3, size * 0.66, y + rng.signed() * 3, size, y);
        ctx.stroke();
      }
      for (let i = 0; i < 6; i++) {
        const x = rng.next() * size;
        const y = rng.next() * size;
        ctx.fillStyle = shade(-40, 0.3);
        ctx.beginPath();
        ctx.ellipse(x, y, rng.range(2, 5), rng.range(3, 7), 0, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      // water: horizontal banding
      for (let i = 0; i < 60; i++) {
        const y = rng.next() * size;
        ctx.fillStyle = shade(rng.signed() * 30, 0.1);
        ctx.fillRect(0, y, size, rng.range(1, 5));
      }
    }
    return c;
  });

/**
 * Soft radial blob used for fog banks and ground haze.
 *
 * Square, with the gradient reaching exactly the edge. The first version drew
 * a radius-128 gradient onto a 256x102 canvas, which clipped the falloff top
 * and bottom and gave every fog bank two hard horizontal edges - visible in
 * play as flat grey slabs across the sky. Callers squash it by setting the
 * sprite's height, which is where a squash belongs.
 */
export const blobTexture = (size = 256): Texture =>
  cached(`blob:${size}`, () => {
    const c = makeCanvas(size, size);
    const ctx = c.getContext('2d')!;
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, 'rgba(255,255,255,0.8)');
    g.addColorStop(0.4, 'rgba(255,255,255,0.34)');
    g.addColorStop(0.72, 'rgba(255,255,255,0.08)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    return c;
  });

/** Small soft dot for particles (silt motes, dust, embers). */
export const particleTexture = (size = 32): Texture =>
  cached(`dot:${size}`, () => {
    const c = makeCanvas(size, size);
    const ctx = c.getContext('2d')!;
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.5, 'rgba(255,255,255,0.5)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    return c;
  });

/** Vignette overlay, drawn multiplicatively over the frame. */
export const vignetteTexture = (size = 512, strength = 0.9): Texture =>
  cached(`vig:${size}:${strength}`, () => {
    const c = makeCanvas(size, size);
    const ctx = c.getContext('2d')!;
    const g = ctx.createRadialGradient(size / 2, size / 2, size * 0.22, size / 2, size / 2, size * 0.72);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(0.7, `rgba(0,0,0,${0.35 * strength})`);
    g.addColorStop(1, `rgba(0,0,0,${strength})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    return c;
  });

/** Caustic-ish light shaft, used for god-rays through broken roofs. */
export const shaftTexture = (w = 128, h = 512): Texture =>
  cached(`shaft:${w}:${h}`, () => {
    const c = makeCanvas(w, h);
    const ctx = c.getContext('2d')!;
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(255,255,255,0.55)');
    g.addColorStop(0.55, 'rgba(255,255,255,0.16)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(w * 0.38, 0);
    ctx.lineTo(w * 0.62, 0);
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fill();
    return c;
  });

export const disposeTextureCache = (): void => {
  for (const tex of cache.values()) tex.destroy(true);
  cache.clear();
};

export const textureCacheSize = (): number => cache.size;
