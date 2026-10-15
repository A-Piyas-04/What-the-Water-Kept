import { Container, Graphics, Sprite, Texture, TilingSprite } from 'pixi.js';
import { clamp01, lerp } from '@/core/math';
import { Rng, fbm1, hashSeed } from '@/core/rng';
import type { SceneDef } from '@/world/types';
import type { Cone } from '@/gameplay/cone';
import { buildProp } from './props';
import { DEPTHS, PLAY_DEPTH, depthFog, depthTint, mix, scaleColor } from './palette';
import { LightingSystem, type LightHandle } from './lighting';
import { ParticleField } from './particles';
import {
  beamMaskTexture,
  blobTexture,
  grainTexture,
  radialGlowTexture,
  shaftTexture,
  verticalGradient,
  vignetteTexture,
} from './textures';

export const DESIGN_HEIGHT = 540;

export interface BeamState {
  on: boolean;
  cone: Cone;
  /** 0..1, ramps as the lamp warms up or is doused. */
  intensity: number;
}

/**
 * Everything visual for one scene.
 *
 * Layer order, bottom to top:
 *   sky -> present bands -> BEFORE bands (masked by the beam) -> actors ->
 *   fog -> particles -> shadow (darkness with lights erased) -> glow -> post
 *
 * The Before layer sitting above the present and masked to the beam is the
 * whole trick: the player is not lighting the ruins, they are cutting a
 * window into 1964 and looking through it.
 */
export class SceneView {
  readonly root = new Container();

  /** Parallax containers for today's world. */
  private readonly presentBands: Container[] = [];
  /** Parallax containers for 1964. Collectively masked by the beam. */
  private readonly beforeBands: Container[] = [];
  private readonly beforeRoot = new Container();
  private readonly beamMask: Sprite;

  /** Actors (player) live on the gameplay plane. */
  readonly actorLayer = new Container();
  /**
   * The Drowned live HERE, inside the masked Before layer.
   *
   * That is not an optimisation - it is the rule made structural. They exist
   * only in 1964, so they are only ever drawn where the beam has cut a window
   * into it. There is no code path that can render one in the dark.
   */
  readonly beforeActorLayer = new Container();
  /** Scene-specific dynamic art (puzzle pieces) on the gameplay plane. */
  readonly dynamicLayer = new Container();

  private readonly worldRoot = new Container();
  /** Holds the player, above the revealed past so she is never hidden by it. */
  private readonly actorRoot = new Container();
  /** Foreground present-day silhouettes, which frame everything. */
  private readonly foreRoot = new Container();
  private readonly skyLayer = new Container();
  private readonly fogLayer = new Container();
  private readonly postLayer = new Container();

  readonly lighting = new LightingSystem();
  readonly particles = new ParticleField(180);

  private readonly fogBanks: Array<{ sprite: Sprite; depth: number; speed: number; phase: number }> = [];
  private readonly shafts: Sprite[] = [];
  private grain: TilingSprite | null = null;
  private vignette: Sprite | null = null;
  private letterTop: Graphics | null = null;
  private letterBottom: Graphics | null = null;

  private readonly lampHandles = new Map<string, LightHandle>();
  private readonly lampDefs: Array<{ id: string; requiresFlag?: string; handle: LightHandle }> = [];

  private scene: SceneDef | null = null;
  private anchorX = 0;
  private anchorY = 0;
  private time = 0;
  private viewW = 960;
  private viewH = 540;
  private scale = 1;
  private lowQuality = false;
  private beforeFade = 0;
  private cinematicBars = 0;

  constructor() {
    this.root.addChild(this.skyLayer);
    this.root.addChild(this.worldRoot);

    for (let i = 0; i < DEPTHS.length; i++) {
      this.presentBands.push(new Container());
      this.beforeBands.push(new Container());
    }

    // --- Present day, behind and around her ---
    for (let i = 0; i <= PLAY_DEPTH; i++) this.worldRoot.addChild(this.presentBands[i]);
    this.worldRoot.addChild(this.dynamicLayer);

    this.root.addChild(this.fogLayer);
    this.root.addChild(this.particles.container);

    // --- Darkness, with the lights punched out of it ---
    this.root.addChild(this.lighting.shadowLayer);

    // --- 1964, ABOVE the darkness ---
    //
    // This ordering is the whole image. The past is not a dim thing the lamp
    // brightens: inside the beam the village is lit, warm and alive, and the
    // present-day valley around it is nearly black. Putting the Before layer
    // under the darkness quad (which is where it started) makes the reveal
    // look like a torch in a cave instead of a window into another night.
    for (let i = 0; i <= PLAY_DEPTH; i++) this.beforeRoot.addChild(this.beforeBands[i]);
    this.beforeRoot.addChild(this.beforeActorLayer);
    for (let i = PLAY_DEPTH + 1; i < DEPTHS.length; i++) {
      this.beforeRoot.addChild(this.beforeBands[i]);
    }
    this.root.addChild(this.beforeRoot);

    // --- Wren, in front of both worlds ---
    this.actorRoot.addChild(this.actorLayer);
    this.root.addChild(this.actorRoot);

    // --- Foreground framing, in front of everything ---
    for (let i = PLAY_DEPTH + 1; i < DEPTHS.length; i++) {
      this.foreRoot.addChild(this.presentBands[i]);
    }
    this.root.addChild(this.foreRoot);

    this.beamMask = new Sprite(beamMaskTexture(512, 512, 0.5));
    this.beamMask.anchor.set(0, 0.5);
    this.beamMask.visible = false;
    // The mask lives in screen space, so it is unaffected by parallax.
    this.root.addChild(this.beamMask);
    this.beforeRoot.mask = this.beamMask;

    this.root.addChild(this.lighting.glowLayer);
    this.root.addChild(this.postLayer);

    this.buildPost();
  }

  private buildPost(): void {
    this.vignette = new Sprite(vignetteTexture(512, 0.95));
    this.postLayer.addChild(this.vignette);

    this.grain = new TilingSprite({ texture: grainTexture(128, 7), width: 960, height: 540 });
    this.grain.alpha = 0.5;
    this.postLayer.addChild(this.grain);

    this.letterTop = new Graphics();
    this.letterBottom = new Graphics();
    this.postLayer.addChild(this.letterTop);
    this.postLayer.addChild(this.letterBottom);
  }

  get currentScene(): SceneDef | null {
    return this.scene;
  }

  /** Design-space viewport, in world units at zoom 1. */
  get viewportWidth(): number {
    return this.viewW;
  }

  get viewportHeight(): number {
    return this.viewH;
  }

  setLowQuality(low: boolean): void {
    this.lowQuality = low;
    this.lighting.setLowQuality(low);
    this.particles.setCapacity(low ? 48 : 180);
    if (this.grain) this.grain.visible = !low;
    for (const s of this.shafts) s.visible = !low;
    for (const f of this.fogBanks) f.sprite.visible = !low || f.depth >= PLAY_DEPTH - 1;
  }

  /**
   * Fits the design viewport to the device.
   *
   * Vertical fit with horizontal reveal: every device sees the same amount of
   * the world vertically, and wider screens simply see further to the sides.
   * That keeps composition predictable from 16:9 to 21:9.
   */
  resize(screenW: number, screenH: number): void {
    this.scale = screenH / DESIGN_HEIGHT;
    this.viewW = screenW / this.scale;
    this.viewH = DESIGN_HEIGHT;
    this.root.scale.set(this.scale);

    this.lighting.resizeDarkness(this.viewW, this.viewH);
    if (this.grain) {
      this.grain.width = this.viewW;
      this.grain.height = this.viewH;
    }
    if (this.vignette) {
      this.vignette.width = this.viewW * 1.02;
      this.vignette.height = this.viewH * 1.02;
      this.vignette.x = -this.viewW * 0.01;
      this.vignette.y = -this.viewH * 0.01;
    }
    this.rebuildSky();
  }

  private rebuildSky(): void {
    this.skyLayer.removeChildren().forEach((c) => c.destroy({ children: true }));
    if (!this.scene) return;
    const p = this.scene.palette;
    const tex = verticalGradient(
      `sky:${p.skyTop}:${p.skyBottom}`,
      [
        [0, p.skyTop, 1],
        [0.62, mix(p.skyTop, p.skyBottom, 0.75), 1],
        [1, p.skyBottom, 1],
      ],
      256,
    );
    const sky = new Sprite(tex);
    sky.width = this.viewW;
    sky.height = this.viewH;
    this.skyLayer.addChild(sky);

    // A single cold key light high in the sky: the moon, or the inspection
    // floodlights up on the dam crest. Gives every exterior one light source.
    if (p.darkness < 0.8) {
      const moon = new Sprite(radialGlowTexture(256, 1.6));
      moon.anchor.set(0.5);
      moon.blendMode = 'add';
      moon.tint = p.ambient;
      moon.width = this.viewW * 1.3;
      moon.height = this.viewH * 1.3;
      moon.x = this.viewW * 0.72;
      moon.y = -this.viewH * 0.1;
      moon.alpha = 0.3 * (1 - p.darkness);
      this.skyLayer.addChild(moon);
    }
  }

  /** Builds all static art for a scene. Call `unload` first. */
  load(scene: SceneDef): void {
    this.unload();
    this.scene = scene;
    this.anchorX = scene.bounds.x + scene.bounds.w * 0.5;
    this.anchorY = scene.bounds.y + scene.bounds.h * 0.5;

    const p = scene.palette;

    // --- Props, bucketed by depth and temporal layer ---
    for (const placement of scene.props) {
      const depth = Math.max(0, Math.min(DEPTHS.length - 1, Math.round(placement.depth)));
      const layer = placement.layer ?? 'present';
      const node = buildProp(placement);
      if (!node) continue;
      const band = layer === 'before' ? this.beforeBands[depth] : this.presentBands[depth];
      band.addChild(node);
    }

    // Tint and haze each band as a whole: one call per band, not per prop.
    for (let d = 0; d < DEPTHS.length; d++) {
      let present = depthTint(p, d, 'present');
      if (d > PLAY_DEPTH) {
        // Foreground bands are drawn above the darkness quad so that they
        // correctly occlude the revealed past, which means they do not get
        // darkened by it. They are the nearest, least-lit things on screen,
        // so they carry the scene's darkness in their own tint instead.
        present = scaleColor(present, 1 - p.darkness * 0.86);
      }
      this.presentBands[d].tint = present;
      this.beforeBands[d].tint = depthTint(p, d, 'before');
    }

    // --- Fog banks ---
    const rng = new Rng(hashSeed(`fog:${scene.id}`));
    const blob = blobTexture(256);
    const bankCount = 16;
    for (let i = 0; i < bankCount; i++) {
      const depth = 1 + Math.floor(rng.next() * 4);
      const sprite = new Sprite(blob);
      sprite.anchor.set(0.5);
      sprite.tint = p.fog;
      sprite.blendMode = 'add';
      const width = rng.range(260, 760);
      sprite.width = width;
      sprite.height = width * rng.range(0.3, 0.55);
      sprite.alpha = depthFog(p, depth) * rng.range(0.16, 0.38);
      this.fogLayer.addChild(sprite);
      this.fogBanks.push({
        sprite,
        depth,
        speed: rng.range(3, 13) * (rng.chance(0.5) ? 1 : -1),
        phase: rng.next() * 1000,
      });
    }

    // --- Static lamps ---
    for (const lamp of scene.lamps) {
      const handle = this.lighting.addLight({
        x: lamp.x,
        y: lamp.y,
        radius: lamp.radius,
        color: lamp.color,
        intensity: lamp.intensity,
        flicker: lamp.flicker ?? 0,
      });
      const id = lamp.id ?? `lamp-${this.lampDefs.length}`;
      this.lampHandles.set(id, handle);
      this.lampDefs.push({ id, requiresFlag: lamp.requiresFlag, handle });
    }

    // --- Particles ---
    this.particles.configure(scene.bounds, {
      silt: scene.particles?.silt ?? 0,
      dust: scene.particles?.dust ?? 0,
      drip: scene.particles?.drips ?? 0,
      ember: scene.particles?.embers ?? 0,
    });

    this.lighting.setDarkness(p.darkness);
    this.rebuildSky();
    this.setLowQuality(this.lowQuality);
  }

  /** Adds a god-ray at a world position (scenes with broken roofs). */
  addLightShaft(x: number, y: number, width: number, height: number, alpha = 0.2): void {
    const s = new Sprite(shaftTexture(128, 512));
    s.anchor.set(0.5, 0);
    s.x = x;
    s.y = y;
    s.width = width;
    s.height = height;
    s.alpha = alpha;
    s.blendMode = 'add';
    s.tint = this.scene?.palette.ambient ?? 0x9fb8c6;
    this.shafts.push(s);
    this.presentBands[PLAY_DEPTH - 1].addChild(s);
  }

  /** Enables/disables a named lamp (doors opening, power restored). */
  setLampEnabled(id: string, enabled: boolean): void {
    const handle = this.lampHandles.get(id);
    if (handle) handle.enabled = enabled;
  }

  /** Re-evaluates flag-gated lamps. */
  refreshLamps(hasFlag: (flag: string) => boolean): void {
    for (const def of this.lampDefs) {
      def.handle.enabled = def.requiresFlag ? hasFlag(def.requiresFlag) : true;
    }
  }

  /**
   * How lit the player is, 0..1.
   *
   * Because she is drawn above the darkness quad she would otherwise be fully
   * visible in a pitch-black tunnel, which would throw away the single best
   * thing about a game built around one lamp. Instead the actor layer is
   * tinted by how much light actually reaches her, so with the lamp off in the
   * dark she is a silhouette, and with it on she is the brightest thing in the
   * valley.
   */
  setActorIllumination(amount: number): void {
    const v = clamp01(amount);
    const level = Math.round(lerp(26, 255, v));
    this.actorLayer.tint = (level << 16) | (level << 8) | level;
  }

  /** Letterbox bars for cinematics, 0..1. */
  setCinematicBars(amount: number): void {
    this.cinematicBars = clamp01(amount);
  }

  /** World -> design-space screen for a given depth band. */
  toScreen(x: number, y: number, depth = PLAY_DEPTH, camX = 0, camY = 0): [number, number] {
    const k = DEPTHS[depth].k;
    return [
      x + this.viewW * 0.5 - this.anchorX - (camX - this.anchorX) * k,
      y + this.viewH * 0.5 - this.anchorY - (camY - this.anchorY) * k,
    ];
  }

  /**
   * Positions every layer for this frame.
   *
   * Parallax is anchored at the scene centre, so authors place every prop in
   * plain world coordinates and still get correct aerial perspective.
   */
  update(
    dt: number,
    camX: number,
    camY: number,
    zoom: number,
    shakeX: number,
    shakeY: number,
    beam: BeamState,
  ): void {
    if (!this.scene) return;
    this.time += dt;
    const cx = camX + shakeX;
    const cy = camY + shakeY;

    this.worldRoot.scale.set(zoom);
    this.beforeRoot.scale.set(zoom);
    this.actorRoot.scale.set(zoom);
    this.foreRoot.scale.set(zoom);
    const halfW = this.viewW * 0.5;
    const halfH = this.viewH * 0.5;

    for (let d = 0; d < DEPTHS.length; d++) {
      const k = DEPTHS[d].k;
      const ox = halfW / zoom - this.anchorX - (cx - this.anchorX) * k;
      const oy = halfH / zoom - this.anchorY - (cy - this.anchorY) * k;
      this.presentBands[d].x = ox;
      this.presentBands[d].y = oy;
      this.beforeBands[d].x = ox;
      this.beforeBands[d].y = oy;
    }
    const playOx = halfW / zoom - cx;
    const playOy = halfH / zoom - cy;
    this.actorLayer.x = playOx;
    this.actorLayer.y = playOy;
    this.beforeActorLayer.x = playOx;
    this.beforeActorLayer.y = playOy;
    this.dynamicLayer.x = playOx;
    this.dynamicLayer.y = playOy;

    // --- Fog drift ---
    for (const bank of this.fogBanks) {
      const k = DEPTHS[bank.depth].k;
      const drift = this.time * bank.speed + bank.phase;
      const span = this.scene.bounds.w + 900;
      const wx = this.scene.bounds.x - 450 + ((drift % span) + span) % span;
      const wy =
        this.scene.bounds.y +
        this.scene.bounds.h * (0.45 + 0.4 * fbm1(bank.phase * 0.01 + this.time * 0.05, 2, 3));
      bank.sprite.x = wx + halfW / zoom - this.anchorX - (cx - this.anchorX) * k;
      bank.sprite.y = wy + halfH / zoom - this.anchorY - (cy - this.anchorY) * k;
    }
    this.fogLayer.scale.set(zoom);

    // --- Particles ride the gameplay plane ---
    this.particles.container.x = playOx * zoom;
    this.particles.container.y = playOy * zoom;
    this.particles.container.scale.set(zoom);
    this.particles.update(dt, cx - this.viewW * 0.5, this.viewW);

    // --- The beam: mask, light, and the window into 1964 ---
    const [bx, by] = this.toScreen(beam.cone.x, beam.cone.y, PLAY_DEPTH, cx, cy);
    const sbx = bx * zoom;
    const sby = by * zoom;
    const beamLen = beam.cone.length * zoom;

    // The Before layer fades rather than snapping, so dousing the lamp feels
    // like a held breath instead of a cut.
    const targetFade = beam.on ? beam.intensity : 0;
    this.beforeFade += (targetFade - this.beforeFade) * Math.min(1, dt * 11);

    const showBefore = this.beforeFade > 0.01;
    this.beforeRoot.visible = showBefore;
    this.beamMask.visible = showBefore;
    this.beforeRoot.alpha = clamp01(this.beforeFade);
    if (showBefore) {
      this.beamMask.x = sbx;
      this.beamMask.y = sby;
      this.beamMask.rotation = beam.cone.angle;
      this.beamMask.width = beamLen;
      this.beamMask.height = beamLen * 1.05;
    }

    this.lighting.updateBeam({
      visible: beam.on && beam.intensity > 0.02,
      x: sbx,
      y: sby,
      angle: beam.cone.angle,
      length: beamLen,
      intensity: beam.intensity,
      color: this.scene.palette.beforeKey,
    });
    this.lighting.update(dt, (x, y) => {
      const [sx, sy] = this.toScreen(x, y, PLAY_DEPTH, cx, cy);
      return [sx * zoom, sy * zoom];
    });

    // --- Post ---
    if (this.grain) {
      this.grain.tilePosition.x = (this.time * 37) % 128;
      this.grain.tilePosition.y = (this.time * 53) % 128;
      this.grain.alpha = 0.42 + fbm1(this.time * 6, 2, 5) * 0.16;
    }
    const barH = this.viewH * 0.085 * this.cinematicBars;
    for (const [bar, y] of [
      [this.letterTop, 0],
      [this.letterBottom, this.viewH - barH],
    ] as const) {
      if (!bar) continue;
      bar.clear();
      if (barH > 0.5) bar.rect(0, y, this.viewW, barH).fill({ color: 0x000000 });
    }
  }

  /**
   * Diagnostic snapshot of the built layers.
   *
   * Used by the browser smoke test to assert that each parallax band actually
   * received the props the scene declared - a band that silently ends up empty
   * renders as nothing at all, which is indistinguishable from "it is dark".
   */
  describeLayers(): {
    scene: string | null;
    present: number[];
    before: number[];
    beforeVisible: boolean;
    beforeAlpha: number;
    maskVisible: boolean;
    beforeBounds: { x: number; y: number; w: number; h: number } | null;
    maskBounds: { x: number; y: number; w: number; h: number } | null;
  } {
    const bounds = (c: Container): { x: number; y: number; w: number; h: number } | null => {
      const b = c.getBounds();
      if (!Number.isFinite(b.width) || b.width <= 0) return null;
      return {
        x: Math.round(b.x),
        y: Math.round(b.y),
        w: Math.round(b.width),
        h: Math.round(b.height),
      };
    };
    return {
      scene: this.scene?.id ?? null,
      present: this.presentBands.map((b) => b.children.length),
      before: this.beforeBands.map((b) => b.children.length),
      beforeVisible: this.beforeRoot.visible,
      beforeAlpha: Number(this.beforeRoot.alpha.toFixed(3)),
      maskVisible: this.beamMask.visible,
      beforeBounds: this.beforeRoot.visible ? bounds(this.beforeRoot) : null,
      maskBounds: this.beamMask.visible ? bounds(this.beamMask) : null,
    };
  }

  /** Destroys all scene art but keeps the view reusable. */
  unload(): void {
    for (const band of [...this.presentBands, ...this.beforeBands]) {
      band.removeChildren().forEach((c) => c.destroy({ children: true }));
      band.tint = 0xffffff;
    }
    this.dynamicLayer.removeChildren().forEach((c) => c.destroy({ children: true }));
    this.actorLayer.removeChildren();
    this.beforeActorLayer.removeChildren();
    this.fogLayer.removeChildren().forEach((c) => c.destroy({ children: true }));
    this.fogBanks.length = 0;
    this.shafts.length = 0;
    this.lighting.clearLights();
    this.lampHandles.clear();
    this.lampDefs.length = 0;
    this.particles.clear();
    this.beforeFade = 0;
    this.scene = null;
  }

  destroy(): void {
    this.unload();
    this.beforeRoot.mask = null;
    this.lighting.destroy();
    this.particles.destroy();
    this.root.destroy({ children: true });
  }
}

export const sharedWhite = (): Texture => Texture.WHITE;
