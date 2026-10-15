import { Container, Graphics, Sprite } from 'pixi.js';
import { clamp, clamp01, lerp } from '@/core/math';
import { fbm1 } from '@/core/rng';
import { radialGlowTexture } from '@/rendering/textures';
import type { SceneId } from '@/world/types';
import type { Director } from './director';

/**
 * Per-scene behaviour that is too specific to be level data.
 *
 * Only three scenes need one. Everything else is expressed as colliders,
 * triggers and puzzle records, which is the point: a scene script is an
 * admission that something is bespoke, so there should be as few as possible.
 */
export interface SceneScript {
  onEnter?: (d: Director) => void;
  onUpdate?: (d: Director, dt: number) => void;
  onRender?: (d: Director, dt: number) => void;
  onExit?: (d: Director) => void;
}

// ---------------------------------------------------------------------- ward

/**
 * The ward keeps the choir running only while she is inside it, and ducks it
 * when she is crouched and still - so hiding is audibly rewarded.
 */
const wardScript: SceneScript = {
  onUpdate: (d) => {
    const inWard = d.player.x > 600;
    if (inWard && d.state.hasFlag('choir-woken') && !d.audio.choirPlaying) {
      d.audio.startChoir(9, 98);
    }
    if (!inWard && d.audio.choirPlaying) d.audio.stopChoir();
    const hiding = d.player.crouched && Math.abs(d.player.body.vx) < 8;
    d.audio.ambience.setIntensity(hiding ? 0.45 : 1);
  },
  onExit: (d) => {
    d.audio.stopChoir();
    d.audio.ambience.setIntensity(1);
  },
};

// ------------------------------------------------------------------- tunnels

/**
 * The counterweight cart and its hanging weight are drawn here rather than as
 * static props, because their position IS the puzzle state.
 */
class CartVisual {
  readonly container = new Container();
  private readonly cart = new Graphics();
  private readonly weight = new Graphics();
  private readonly beam = new Graphics();

  constructor() {
    this.container.addChild(this.beam, this.weight, this.cart);
  }

  update(position: number): void {
    const t = clamp01(position);

    // The cart climbs the graded rail from x=1520 to x=2060.
    const cx = lerp(1520, 2060, t);
    const cy = lerp(48, 48, t);
    this.cart.clear();
    this.cart.rect(cx, cy - 46, 70, 30).fill({ color: 0x3a332c });
    this.cart.rect(cx, cy - 46, 70, 4).fill({ color: 0x5a5046 });
    this.cart.circle(cx + 16, cy - 8, 9).fill({ color: 0x2b2620 });
    this.cart.circle(cx + 54, cy - 8, 9).fill({ color: 0x2b2620 });
    this.cart.circle(cx + 16, cy - 8, 3).fill({ color: 0x6a5f52 });
    this.cart.circle(cx + 54, cy - 8, 3).fill({ color: 0x6a5f52 });
    // Cable back to the winch.
    this.cart.poly([1250, cy - 34, cx, cy - 32]).stroke({ width: 1.6, color: 0x6d6153 });

    // The counterweight drops as the cart climbs.
    const wy = lerp(-120, 20, t);
    this.weight.clear();
    this.weight.rect(1252, wy - 54, 30, 54).fill({ color: 0x332d27 });
    this.weight.rect(1252, wy - 54, 30, 3).fill({ color: 0x5c5248 });
    this.weight.poly([1267, -170, 1267, wy - 54]).stroke({ width: 2, color: 0x6d6153 });

    // The roof beam lifts clear of the passage.
    const by = lerp(222, 150, t);
    this.beam.clear();
    this.beam.rect(2150, by - 26, 200, 26).fill({ color: 0x2e2822 });
    this.beam.rect(2150, by - 26, 200, 3).fill({ color: 0x564c42 });
  }

  destroy(): void {
    this.container.destroy({ children: true });
  }
}

let cartVisual: CartVisual | null = null;

const tunnelsScript: SceneScript = {
  onEnter: (d) => {
    cartVisual = new CartVisual();
    d.sceneDynamicLayer.addChild(cartVisual.container);
    cartVisual.update(d.puzzles.counterweight.visualPosition);
  },
  onRender: (d) => {
    cartVisual?.update(d.puzzles.counterweight.visualPosition);
  },
  onExit: () => {
    cartVisual?.destroy();
    cartVisual = null;
  },
};

// ---------------------------------------------------------------- gatehouse

/** The three dials are drawn at their current detents. */
class DialVisual {
  readonly container = new Container();
  private readonly g = new Graphics();

  constructor(private readonly xs: readonly number[]) {
    this.container.addChild(this.g);
  }

  update(detents: readonly number[]): void {
    const g = this.g;
    g.clear();
    for (let i = 0; i < this.xs.length; i++) {
      const x = this.xs[i];
      const y = -176;
      const angle = (detents[i] / 12) * Math.PI * 2 - Math.PI / 2;
      // Pointer.
      g.poly([x, y, x + Math.cos(angle) * 26, y + Math.sin(angle) * 26])
        .stroke({ width: 4, color: 0xd8cbb4 });
      g.circle(x, y, 5).fill({ color: 0xd8cbb4 });
      g.circle(x, y, 2.4).fill({ color: 0x24201b });
    }
  }

  destroy(): void {
    this.container.destroy({ children: true });
  }
}

let dialVisual: DialVisual | null = null;

const gatehouseScript: SceneScript = {
  onEnter: (d) => {
    dialVisual = new DialVisual([820, 1040, 1260]);
    d.sceneDynamicLayer.addChild(dialVisual.container);
    dialVisual.update([0, 1, 2].map((i) => d.puzzles.sluice.dialAt(i)));
  },
  onRender: (d) => {
    dialVisual?.update([0, 1, 2].map((i) => d.puzzles.sluice.dialAt(i)));
  },
  onExit: () => {
    dialVisual?.destroy();
    dialVisual = null;
  },
};

// --------------------------------------------------------------------- gate

/**
 * The finale: the reservoir refilling.
 *
 * The water is a real hazard volume that rises over ninety seconds, which is
 * generous - the walk east takes about twenty. The timer exists to make the
 * ending a decision made under pressure, not a reflex test. If she drowns she
 * respawns at the last checkpoint on the apron with the water reset, so the
 * sequence is retryable without replaying the chapter.
 */
class FloodVisual {
  readonly container = new Container();
  private readonly g = new Graphics();
  private readonly shimmer: Sprite;
  private t = 0;

  constructor() {
    this.container.addChild(this.g);
    this.shimmer = new Sprite(radialGlowTexture(256, 1.4));
    this.shimmer.anchor.set(0.5);
    this.shimmer.blendMode = 'add';
    this.shimmer.tint = 0x9fc0d4;
    this.shimmer.alpha = 0.1;
    this.container.addChild(this.shimmer);
  }

  update(dt: number, level: number, camX: number): void {
    this.t += dt;
    const g = this.g;
    g.clear();
    if (!Number.isFinite(level)) {
      this.shimmer.visible = false;
      return;
    }
    this.shimmer.visible = true;

    const x0 = camX - 900;
    const x1 = camX + 900;
    // Body of water.
    g.rect(x0, level, x1 - x0, 800).fill({ color: 0x1b2a33, alpha: 0.9 });

    // Surface: a moving line, which is the only animated silhouette on screen
    // and therefore reads instantly as "rising".
    const pts: number[] = [];
    const steps = 48;
    for (let i = 0; i <= steps; i++) {
      const x = x0 + ((x1 - x0) * i) / steps;
      const wave =
        Math.sin(x * 0.012 + this.t * 2.1) * 2.4 +
        Math.sin(x * 0.031 - this.t * 1.3) * 1.3 +
        fbm1(x * 0.004 + this.t * 0.5, 2, 9) * 2.6;
      pts.push(x, level + wave);
    }
    g.poly([...pts, x1, level + 60, x0, level + 60]).fill({ color: 0x273c47, alpha: 0.85 });
    g.poly(pts).stroke({ width: 2.2, color: 0xb6d4e2, alpha: 0.65 });

    // Foam and debris riding the surface.
    for (let i = 0; i < 26; i++) {
      const fx = x0 + ((x1 - x0) * ((i * 73 + this.t * 40) % 1000)) / 1000;
      const fy = level + Math.sin(fx * 0.02 + this.t * 2) * 2;
      g.rect(fx, fy - 1, 10 + (i % 5) * 4, 1.6).fill({ color: 0xc8dee8, alpha: 0.2 });
    }

    this.shimmer.x = camX;
    this.shimmer.y = level;
    this.shimmer.width = 1800;
    this.shimmer.height = 260;
    this.shimmer.alpha = 0.07 + Math.sin(this.t * 1.7) * 0.02;
  }

  destroy(): void {
    this.container.destroy({ children: true });
  }
}

let floodVisual: FloodVisual | null = null;
let floodElapsed = 0;

/** Seconds for the water to climb from the apron to the valley side. */
const FLOOD_DURATION = 92;
const FLOOD_START_Y = 120;
const FLOOD_END_Y = -150;

const gateScript: SceneScript = {
  onEnter: (d) => {
    floodElapsed = 0;
    floodVisual = new FloodVisual();
    d.sceneDynamicLayer.addChild(floodVisual.container);
    d.waterLevel = FLOOD_START_Y;
    d.audio.startFlood();
    d.audio.setFlood(0.25);
  },
  onUpdate: (d, dt) => {
    floodElapsed += dt;
    const t = clamp01(floodElapsed / FLOOD_DURATION);
    // Eased so the first third is slow and the last third is frightening.
    const eased = t * t * (3 - 2 * t);
    d.waterLevel = lerp(FLOOD_START_Y, FLOOD_END_Y, eased);
    d.audio.setFlood(0.25 + eased * 0.7);
    if (t > 0.55) d.camera.shake(clamp((t - 0.55) * 1.6, 0, 1.1), 0.3);
  },
  onRender: (d, dt) => {
    floodVisual?.update(dt, d.waterLevel, d.camera.x);
  },
  onExit: (d) => {
    floodVisual?.destroy();
    floodVisual = null;
    d.audio.stopFlood();
  },
};

const SCRIPTS: Partial<Record<SceneId, SceneScript>> = {
  ward: wardScript,
  tunnels: tunnelsScript,
  gatehouse: gatehouseScript,
  gate: gateScript,
};

export const getSceneScript = (id: SceneId): SceneScript | null => SCRIPTS[id] ?? null;

/** Resets module-level script state. Used when returning to the title. */
export const resetScripts = (): void => {
  cartVisual?.destroy();
  cartVisual = null;
  dialVisual?.destroy();
  dialVisual = null;
  floodVisual?.destroy();
  floodVisual = null;
  floodElapsed = 0;
};
