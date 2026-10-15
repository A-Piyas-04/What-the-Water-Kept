import { Container, Sprite } from 'pixi.js';
import { clamp01 } from '@/core/math';
import { fbm1 } from '@/core/rng';
import { beamTexture, radialGlowTexture } from './textures';

export interface LightHandle {
  readonly shadow: Sprite;
  readonly glow: Sprite;
  x: number;
  y: number;
  radius: number;
  color: number;
  intensity: number;
  flicker: number;
  enabled: boolean;
}

/**
 * Two-pass 2D lighting.
 *
 * Pass 1 (`shadowLayer`) is a flat darkness quad with the lights punched out of
 * it using the `erase` blend mode. Because the layer is its own render group,
 * erasing removes alpha from the darkness rather than painting black, so the
 * world shows through at full value wherever a light reaches.
 *
 * Pass 2 (`glowLayer`) adds the visible bloom in each light's own colour.
 *
 * It is a handful of additively blended sprites per frame: no per-pixel shader,
 * no render-texture ping-pong, and it holds 60fps on mid-range Android.
 */
export class LightingSystem {
  /** Darkness with holes. Sits above the world, below the UI. */
  readonly shadowLayer = new Container();
  /** Coloured bloom. Sits above the shadow layer. */
  readonly glowLayer = new Container();

  private readonly darkness: Sprite;
  private readonly lights: LightHandle[] = [];

  /** The lantern beam: the player's light, and the game's central object. */
  private readonly beamShadow: Sprite;
  private readonly beamGlow: Sprite;

  private time = 0;
  private darknessAlpha = 0.7;
  private lowQuality = false;

  constructor() {
    // `isRenderGroup` gives the shadow layer its own render target, which is
    // what makes `erase` subtract from the darkness instead of the backdrop.
    this.shadowLayer.isRenderGroup = true;

    this.darkness = new Sprite(radialGlowTexture(4, 0));
    this.darkness.tint = 0x000000;
    this.shadowLayer.addChild(this.darkness);

    const beamTex = beamTexture(512, 512, 0.5, 0.5);
    this.beamShadow = new Sprite(beamTex);
    this.beamShadow.anchor.set(0, 0.5);
    this.beamShadow.blendMode = 'erase';
    this.beamShadow.visible = false;
    this.shadowLayer.addChild(this.beamShadow);

    this.beamGlow = new Sprite(beamTex);
    this.beamGlow.anchor.set(0, 0.5);
    this.beamGlow.blendMode = 'add';
    this.beamGlow.visible = false;
    this.glowLayer.addChild(this.beamGlow);
  }

  setLowQuality(low: boolean): void {
    this.lowQuality = low;
  }

  /** Covers the viewport. Called on resize. */
  resizeDarkness(w: number, h: number): void {
    // The darkness quad is a 4x4 texture stretched over the screen; its own
    // soft falloff is irrelevant because only its alpha channel matters.
    this.darkness.width = w;
    this.darkness.height = h;
    this.darkness.x = 0;
    this.darkness.y = 0;
  }

  setDarkness(alpha: number): void {
    this.darknessAlpha = clamp01(alpha);
  }

  addLight(opts: {
    x: number;
    y: number;
    radius: number;
    color: number;
    intensity: number;
    flicker?: number;
  }): LightHandle {
    const tex = radialGlowTexture(256, 2.4);
    const shadow = new Sprite(tex);
    shadow.anchor.set(0.5);
    shadow.blendMode = 'erase';
    this.shadowLayer.addChild(shadow);

    const glow = new Sprite(tex);
    glow.anchor.set(0.5);
    glow.blendMode = 'add';
    this.glowLayer.addChild(glow);

    const handle: LightHandle = {
      shadow,
      glow,
      x: opts.x,
      y: opts.y,
      radius: opts.radius,
      color: opts.color,
      intensity: opts.intensity,
      flicker: opts.flicker ?? 0,
      enabled: true,
    };
    this.lights.push(handle);
    return handle;
  }

  removeLight(handle: LightHandle): void {
    const i = this.lights.indexOf(handle);
    if (i >= 0) this.lights.splice(i, 1);
    handle.shadow.destroy();
    handle.glow.destroy();
  }

  clearLights(): void {
    for (const l of [...this.lights]) this.removeLight(l);
  }

  /**
   * Positions the beam. `x`/`y` are the lantern in SCREEN space, `angle` in
   * radians, `length` in screen pixels.
   */
  updateBeam(opts: {
    visible: boolean;
    x: number;
    y: number;
    angle: number;
    length: number;
    intensity: number;
    color: number;
  }): void {
    this.beamShadow.visible = opts.visible;
    this.beamGlow.visible = opts.visible && !this.lowQuality;
    if (!opts.visible) return;

    // A real sodium lamp never sits perfectly still.
    const wobble = (fbm1(this.time * 5.5, 3, 91) - 0.5) * 0.045;
    const jitter = 0.92 + fbm1(this.time * 9, 2, 17) * 0.12;

    for (const s of [this.beamShadow, this.beamGlow]) {
      s.x = opts.x;
      s.y = opts.y;
      s.rotation = opts.angle + wobble;
      s.width = opts.length;
      s.height = opts.length * 1.08;
    }
    this.beamShadow.alpha = clamp01(opts.intensity * jitter);
    // The glow is airborne haze in the beam, not the beam itself. Pushed any
    // higher it becomes an additive wash that flattens the lit past into a
    // smooth orange cone with no detail in it.
    this.beamGlow.alpha = clamp01(opts.intensity * jitter * 0.15);
    this.beamGlow.tint = opts.color;
  }

  /**
   * Updates every light sprite. Lights are authored in WORLD space; the caller
   * supplies the world->screen transform for the gameplay plane.
   */
  update(dt: number, toScreen: (x: number, y: number) => [number, number]): void {
    this.time += dt;
    this.darkness.alpha = this.darknessAlpha;

    for (const l of this.lights) {
      const flick =
        l.flicker > 0
          ? 1 - l.flicker * (1 - fbm1(this.time * (3 + l.flicker * 9) + l.x * 0.01, 3, l.radius | 0))
          : 1;
      const [sx, sy] = toScreen(l.x, l.y);
      const diameter = l.radius * 2;

      l.shadow.visible = l.enabled;
      l.glow.visible = l.enabled && !this.lowQuality;
      if (!l.enabled) continue;

      l.shadow.x = sx;
      l.shadow.y = sy;
      l.shadow.width = diameter;
      l.shadow.height = diameter;
      l.shadow.alpha = clamp01(l.intensity * flick);

      l.glow.x = sx;
      l.glow.y = sy;
      l.glow.width = diameter * 1.15;
      l.glow.height = diameter * 1.15;
      l.glow.alpha = clamp01(l.intensity * flick * 0.3);
      l.glow.tint = l.color;
    }
  }

  destroy(): void {
    this.clearLights();
    this.shadowLayer.destroy({ children: true });
    this.glowLayer.destroy({ children: true });
  }
}
