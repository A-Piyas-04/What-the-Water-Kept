import { EventBus, Subscriptions } from '@/core/events';
import { clamp, clamp01, damp, rectsOverlap } from '@/core/math';
import type { Rect } from '@/core/math';
import { GameAudio } from '@/audio';
import { Controls } from '@/input/controls';
import { CollisionWorld, type SolidityQuery } from '@/physics/collision';
import type { Collider } from '@/physics/types';
import { Camera } from '@/rendering/camera';
import { type BeamState, SceneView } from '@/rendering/scene-view';
import { Player } from '@/player/player';
import { PuzzleRegistry, type PuzzleContext } from '@/puzzles';
import { ChalkPuzzle } from '@/puzzles/chalk';
import { WARD_SECTION, WARD_START } from '@/scenes/ward';
import { SCENES, chapterOf } from '@/scenes';
import type { Facing, InteractableDef, SceneDef, SceneId, TriggerDef } from '@/world/types';
import { CinematicPlayer, type CinematicStep, getCinematic } from './cinematics';
import { type Cone, coneRect } from './cone';
import { Drowned } from './drowned';
import { GameState } from './state';
import { getSceneScript, type SceneScript } from './scripts';

export interface DirectorEvents {
  /** Narration to display. The director waits for `dismissText`. */
  showText: { textId: string; fromCinematic: boolean };
  /** Context prompt changed (null hides it). */
  prompt: { verb: string; label: string; id: string } | null;
  /** A clue was filed. */
  clue: { clueId: string };
  /** An item was taken. */
  item: { itemId: string };
  /** Chapter card. */
  chapter: { sceneId: SceneId; title: string; subtitle: string };
  /** Fade level 0..1. */
  fade: { amount: number; immediate: boolean };
  /** She was taken, or drowned. */
  death: { reason: 'taken' | 'water'; textId: string };
  /** The run is over. */
  ending: { endingId: string };
  /** A puzzle resolved. */
  solved: { puzzleId: string };
  /** Cinematic started/stopped, so the UI can show a skip affordance. */
  cinematic: { id: string | null; skippable: boolean };
  /** Progress worth writing to disk. */
  autosave: { reason: string };
}

const INTERACT_PAD = 26;

/**
 * The gameplay director.
 *
 * Owns the simulation: it loads scenes, runs the player and the Drowned,
 * resolves interactions and triggers, drives cinematics, and decides when the
 * player has died or finished. Everything above it (the UI) only listens to
 * events, and everything below it (physics, rendering, audio) only gets told
 * what to do - which is what keeps the fixed-step simulation free of any
 * dependency on the renderer or the DOM.
 */
export class Director {
  readonly events = new EventBus<DirectorEvents>();
  readonly state = new GameState();
  readonly puzzles = new PuzzleRegistry();
  readonly player: Player;
  readonly camera = new Camera();
  readonly cinematic = new CinematicPlayer();

  private world = new CollisionWorld([]);
  private scene: SceneDef | null = null;
  private script: SceneScript | null = null;
  private drowned: Drowned[] = [];
  private subs = new Subscriptions();

  /** Interactables whose `once` has been consumed, as flags. */
  private activePrompt: InteractableDef | null = null;
  private pendingTextId: string | null = null;
  private textIsCinematic = false;

  private fadeAmount = 0;
  private fadeTarget = 0;
  private barsTarget = 0;
  private dying = false;
  private dyingTimer = 0;
  private deathReason: 'taken' | 'water' = 'taken';
  private paused = false;
  private time = 0;

  /** Scripted walk target during cinematics. */
  private walkTarget: { x: number; speed: number } | null = null;
  private lockedPose = false;

  /** Set by the gate scene's script. */
  waterLevel = Number.POSITIVE_INFINITY;

  private readonly puzzleCtx: PuzzleContext;

  constructor(
    private readonly view: SceneView,
    readonly audio: GameAudio,
    private readonly controls: Controls,
  ) {
    this.player = new Player({
      onFootstep: (state) => this.onFootstep(state),
      onLanded: (impact) => this.onLanded(impact),
    });
    this.puzzleCtx = {
      state: this.state,
      onSolved: (id) => this.onPuzzleSolved(id),
      onFeedback: (id, kind) => this.onPuzzleFeedback(id, kind),
    };
  }

  // ------------------------------------------------------------ scene loading

  /**
   * Loads a scene and places the player.
   *
   * Everything built here is torn down by `unloadScene`, which is called first
   * - including every event subscription, so repeated loads cannot accumulate
   * duplicate listeners.
   */
  loadScene(id: SceneId, spawnId = 'default'): void {
    this.unloadScene();

    const scene = SCENES[id];
    this.scene = scene;
    this.state.sceneId = id;
    this.state.spawnId = spawnId;
    this.state.setChapter(chapterOf(id));

    this.world = new CollisionWorld(scene.colliders);
    this.view.load(scene);
    this.view.refreshLamps((flag) => this.state.hasFlag(flag));

    this.camera.setBounds(scene.bounds);
    this.camera.setFraming(null);

    const spawn = scene.spawns[spawnId] ?? scene.spawns.default;
    this.player.placeAt(spawn.x, spawn.y, spawn.facing, this.world, this.solidity);
    this.player.lantern.found = this.state.hasItem('item-lantern');
    this.player.lantern.reset();
    this.player.lantern.found = this.state.hasItem('item-lantern');
    this.view.actorLayer.addChild(this.player.character.container);

    // --- The Drowned ---
    for (const def of scene.drowned) {
      if (def.requiresFlag && !this.state.hasFlag(def.requiresFlag)) continue;
      if (def.hiddenByFlag && this.state.hasFlag(def.hiddenByFlag)) continue;
      const d = new Drowned(def, undefined, {
        onNoticed: (who) => this.onDrownedNoticed(who),
        onTookHer: (who) => this.onTaken(who),
        onStep: (who, near) => this.audio.synth.approach(near * 0.4 + 0.3 * (who.state === 'pursuing' ? 1 : 0)),
      });
      // The Drowned live in the Before layer, so the beam mask hides them.
      this.view.beforeActorLayer.addChild(d.container);
      this.view.actorLayer.addChild(d.disturbance.container);
      this.drowned.push(d);
    }

    this.puzzles.loadAll(this.puzzleCtx);
    this.script = getSceneScript(id);
    this.script?.onEnter?.(this);

    this.camera.snapTo(this.player.x, this.player.y);
    this.view.resize(this.lastScreenW, this.lastScreenH);

    this.audio.playAmbience(scene.ambience);
    this.events.emit('chapter', {
      sceneId: id,
      title: scene.title,
      subtitle: scene.subtitle,
    });
    this.events.emit('autosave', { reason: `scene:${id}` });

    // Entering a scene is always a checkpoint.
    this.state.setCheckpoint(id, spawnId);

    const intro = scene.introCinematic;
    if (intro && !this.state.hasFlag(`cine:${intro}`)) {
      this.startCinematic(intro);
    }
  }

  private unloadScene(): void {
    this.subs.dispose();
    this.subs = new Subscriptions();
    for (const d of this.drowned) d.destroy();
    this.drowned = [];
    this.script?.onExit?.(this);
    this.script = null;
    this.activePrompt = null;
    this.events.emit('prompt', null);
    this.audio.stopChoir();
    this.view.unload();
    this.waterLevel = Number.POSITIVE_INFINITY;
  }

  private lastScreenW = 960;
  private lastScreenH = 540;

  resize(w: number, h: number): void {
    this.lastScreenW = w;
    this.lastScreenH = h;
    this.view.resize(w, h);
    this.camera.viewHalfW = this.view.viewportWidth * 0.5;
    this.camera.viewHalfH = this.view.viewportHeight * 0.5;
  }

  // ------------------------------------------------------------------ queries

  /**
   * The solidity query handed to the collision solver.
   *
   * This is where the lantern becomes physics: a Before-layer collider is a
   * real floor only while the beam is on it.
   */
  readonly solidity: SolidityQuery = {
    isBeforeLit: (c: Collider) => {
      const cone = this.beamCone;
      if (cone.length <= 0) return false;
      return coneRect(cone, c);
    },
    hasFlag: (flag: string) => this.state.hasFlag(flag),
  };

  private get beamCone(): Cone {
    return this.player.lantern.cone;
  }

  get currentScene(): SceneDef | null {
    return this.scene;
  }

  /** Where scene scripts attach their dynamic art. */
  get sceneDynamicLayer(): typeof this.view.dynamicLayer {
    return this.view.dynamicLayer;
  }

  get beamState(): BeamState {
    const lantern = this.player.lantern;
    return {
      on: lantern.on && lantern.found,
      cone: lantern.cone,
      intensity: clamp01(lantern.intensity),
    };
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
    this.controls.setEnabled(!paused);
  }

  get isPaused(): boolean {
    return this.paused;
  }

  // --------------------------------------------------------------- simulation

  /** Fixed-timestep simulation step. */
  fixedUpdate(dt: number): void {
    if (!this.scene || this.paused) return;
    this.time += dt;
    this.state.playTime += dt;

    const input = this.controls.state;

    // --- Narration blocks the world ---
    if (this.pendingTextId) {
      this.player.locked = true;
      this.player.update(dt, { moveX: 0, moveY: 0, magnitude: 0, run: false, crouch: false, up: false, down: false }, this.world, this.solidity);
      this.updateFade(dt);
      return;
    }

    // --- Death ---
    if (this.dying) {
      this.dyingTimer -= dt;
      this.fadeTarget = 1;
      this.updateFade(dt);
      if (this.dyingTimer <= 0) this.respawn();
      return;
    }

    // --- Cinematic ---
    if (this.cinematic.playing) {
      this.cinematic.update(dt, (step) => this.applyCinematicStep(step));
      if (!this.cinematic.playing) this.endCinematic();
      this.runScriptedBody(dt);
      this.updateWorld(dt);
      this.updateFade(dt);
      return;
    }

    // --- Lantern toggle ---
    if (input.lanternPressed) {
      if (this.player.lantern.found && !this.player.lantern.isSuppressed) {
        this.player.lantern.toggle();
        if (this.player.lantern.on) this.audio.synth.lanternOn();
        else this.audio.synth.lanternOff();
      } else {
        this.audio.synth.lanternDenied();
      }
    }

    // --- Interaction ---
    if (input.interactPressed && this.activePrompt) {
      this.useInteractable(this.activePrompt);
    }

    this.player.locked = false;
    this.player.update(
      dt,
      {
        moveX: input.moveX,
        moveY: input.moveY,
        magnitude: input.magnitude,
        run: input.run,
        crouch: input.crouch,
        up: input.up,
        down: input.down,
      },
      this.world,
      this.solidity,
    );

    this.updateWorld(dt);
    this.updateFade(dt);
  }

  /** Everything that runs whether or not the player has control. */
  private updateWorld(dt: number): void {
    if (!this.scene) return;
    const cone = this.beamCone;

    // --- The Drowned ---
    let dread = 0;
    for (const d of this.drowned) {
      d.update(dt, cone, this.player.x, this.player.centerY);
      dread = Math.max(dread, d.dreadContribution(this.player.x, this.player.centerY));
    }
    // Darkness alone is oppressive; the scene's own darkness contributes.
    dread = Math.max(dread, (this.scene.palette.darkness - 0.5) * 0.4);
    this.player.setDread(damp(this.player.dread, dread, 2.4, dt));
    this.audio.setDread(this.player.dread);

    // --- Triggers ---
    this.evaluateTriggers();

    // --- Interaction prompt ---
    this.evaluatePrompt();

    // --- Puzzle ticks ---
    this.puzzles.counterweight.input(this.puzzleCtx, { kind: 'tick', dt, lit: false });
    this.updateBridgePuzzle();
    this.updateChalkPuzzle();

    // --- Scene script ---
    this.script?.onUpdate?.(this, dt);

    // --- Hazards ---
    if (this.player.body.inHazard || this.player.y > this.waterLevel) {
      this.die('water');
    }

    // --- Out-of-bounds rescue ---
    // A body that escapes the level geometry would otherwise fall forever,
    // which is an unrecoverable soft-lock. This is the backstop: it returns
    // her to the last checkpoint and is deliberately NOT counted as a death,
    // because it is never the player's fault.
    this.checkBounds();

    // --- Camera ---
    this.camera.update(dt, {
      x: this.player.x,
      y: this.player.centerY,
      facing: this.player.facing,
      speed01: this.player.speed01,
    });
  }

  /**
   * Catches a player who has left the world.
   *
   * The collision solver and the level audit between them should make this
   * unreachable; it exists because "should" is not a guarantee, and because
   * silently recovering is strictly better than a player sitting in a void
   * with no way back.
   */
  private checkBounds(): void {
    if (!this.scene || this.dying || this.rescuing) return;
    const b = this.scene.bounds;
    const margin = 260;
    const out =
      this.player.y > b.y + b.h + margin ||
      this.player.y < b.y - margin * 3 ||
      this.player.x < b.x - margin ||
      this.player.x > b.x + b.w + margin;
    if (!out) return;

    if (import.meta.env?.DEV) {
      console.warn(
        `[director] rescued the player from outside ${this.scene.id} at ` +
          `${Math.round(this.player.x)},${Math.round(this.player.y)}`,
      );
    }
    this.rescuing = true;
    this.fadeTarget = 1;
    window.setTimeout(() => {
      const scene = this.state.checkpointScene;
      const spawn = this.state.checkpointSpawn;
      if (scene !== this.scene?.id) {
        this.loadScene(scene, spawn);
      } else {
        const point = this.scene.spawns[spawn] ?? this.scene.spawns.default;
        this.player.placeAt(point.x, point.y, point.facing, this.world, this.solidity);
        for (const d of this.drowned) d.restore();
        this.camera.snapTo(this.player.x, this.player.y);
      }
      this.fadeTarget = 0;
      this.rescuing = false;
    }, 320);
  }

  private rescuing = false;

  /** Walks the player under cinematic control. */
  private runScriptedBody(dt: number): void {
    this.player.locked = true;
    let moveX = 0;
    if (this.walkTarget) {
      const dx = this.walkTarget.x - this.player.x;
      if (Math.abs(dx) < 6) {
        this.walkTarget = null;
      } else {
        moveX = Math.sign(dx) * clamp01(this.walkTarget.speed / 182);
        this.player.locked = false;
      }
    }
    this.player.update(
      dt,
      { moveX, moveY: 0, magnitude: Math.abs(moveX), run: false, crouch: false, up: false, down: false },
      this.world,
      this.solidity,
    );
    if (this.lockedPose) this.player.locked = true;
  }

  private updateFade(dt: number): void {
    this.fadeAmount = damp(this.fadeAmount, this.fadeTarget, 6, dt);
    if (Math.abs(this.fadeAmount - this.fadeTarget) < 0.004) this.fadeAmount = this.fadeTarget;
    this.events.emit('fade', { amount: this.fadeAmount, immediate: false });
    this.view.setCinematicBars(damp(this.barsNow, this.barsTarget, 7, dt));
    this.barsNow = damp(this.barsNow, this.barsTarget, 7, dt);
  }

  private barsNow = 0;

  /**
   * How much light is actually on Wren right now.
   *
   * Her own lamp always reaches her, the scene's ambient sets a floor, and any
   * static lamp she is standing in contributes. Used to tint the actor layer,
   * which sits above the darkness.
   */
  private actorIllumination(): number {
    if (!this.scene) return 1;
    const p = this.scene.palette;
    let light = clamp01(1 - p.darkness) * 0.9 + 0.1;
    if (this.player.lantern.lit) {
      light = Math.max(light, 0.55 + this.player.lantern.intensity * 0.45);
    }
    for (const lamp of this.scene.lamps) {
      if (lamp.layer !== 'present') continue;
      if (lamp.requiresFlag && !this.state.hasFlag(lamp.requiresFlag)) continue;
      const d = Math.hypot(lamp.x - this.player.x, lamp.y - this.player.centerY);
      if (d > lamp.radius) continue;
      light = Math.max(light, (1 - d / lamp.radius) * lamp.intensity * 1.5);
    }
    return clamp01(light);
  }

  /** Variable-step visual update. */
  render(dt: number): void {
    if (!this.scene) return;
    this.player.render(dt);
    this.view.setActorIllumination(this.actorIllumination());
    for (const d of this.drowned) d.render(dt);
    const [sx, sy] = this.camera.shakeOffset(this.time);
    this.view.update(
      dt,
      this.camera.x,
      this.camera.y,
      this.camera.zoom,
      sx,
      sy,
      this.beamState,
    );
    this.script?.onRender?.(this, dt);
  }

  // -------------------------------------------------------------- triggers

  private triggerFired(id: string): boolean {
    return this.state.hasFlag(`trig:${id}`);
  }

  private evaluateTriggers(): void {
    if (!this.scene) return;
    const rect = this.player.rect;
    let framing: TriggerDef['camera'] | null = null;

    for (const trigger of this.scene.triggers) {
      const inside = rectsOverlap(rect, trigger.zone);

      if (trigger.kind === 'camera') {
        if (inside) framing = trigger.camera ?? null;
        continue;
      }

      if (!inside) continue;
      if (trigger.requiresFlag && !this.state.hasFlag(trigger.requiresFlag)) continue;
      if (trigger.hiddenByFlag && this.state.hasFlag(trigger.hiddenByFlag)) continue;
      if (trigger.requiresLantern && !this.player.lantern.lit) continue;
      if (trigger.requiresLanternOff && this.player.lantern.lit) continue;

      if (trigger.kind === 'checkpoint') {
        if (trigger.checkpointId) {
          this.state.setCheckpoint(this.scene.id, trigger.checkpointId);
        }
        continue;
      }

      const once = trigger.once !== false;
      if (once && this.triggerFired(trigger.id)) continue;
      if (once) this.state.setFlag(`trig:${trigger.id}`);

      if (trigger.setsFlag) this.state.setFlag(trigger.setsFlag);
      if (trigger.checkpointId) this.state.setCheckpoint(this.scene.id, trigger.checkpointId);

      switch (trigger.kind) {
        case 'story':
        case 'scare':
          if (trigger.cinematicId) this.startCinematic(trigger.cinematicId);
          else if (trigger.textId) this.showText(trigger.textId, false);
          break;
        case 'cinematic':
          if (trigger.cinematicId) this.startCinematic(trigger.cinematicId);
          else if (trigger.textId) this.showText(trigger.textId, false);
          break;
        case 'exit':
          if (trigger.exitTo) {
            this.transitionTo(trigger.exitTo, trigger.exitSpawn ?? 'default');
            return;
          }
          break;
        case 'death':
          this.die('water');
          return;
        case 'flag':
          break;
        default:
          break;
      }
    }

    this.camera.setFraming(framing);
  }

  // ---------------------------------------------------------- interactables

  private isInteractableAvailable(def: InteractableDef): boolean {
    if (def.once && this.state.hasFlag(`used:${def.id}`)) return false;
    if (def.requiresFlag && !this.state.hasFlag(def.requiresFlag)) return false;
    if (def.hiddenByFlag && this.state.hasFlag(def.hiddenByFlag)) return false;
    if (def.requiresLight) {
      const cone = this.beamCone;
      if (cone.length <= 0 || !coneRect(cone, def.zone)) return false;
    }
    return true;
  }

  private evaluatePrompt(): void {
    if (!this.scene) return;
    const body = this.player.rect;
    const reach: Rect = {
      x: body.x - INTERACT_PAD,
      y: body.y - INTERACT_PAD,
      w: body.w + INTERACT_PAD * 2,
      h: body.h + INTERACT_PAD * 2,
    };

    let best: InteractableDef | null = null;
    let bestDistance = Infinity;
    for (const def of this.scene.interactables) {
      if (!rectsOverlap(reach, def.zone)) continue;
      if (!this.isInteractableAvailable(def)) continue;
      const cx = def.zone.x + def.zone.w * 0.5;
      const d = Math.abs(cx - this.player.x);
      if (d < bestDistance) {
        bestDistance = d;
        best = def;
      }
    }

    if (best?.id !== this.activePrompt?.id) {
      this.activePrompt = best;
      this.events.emit(
        'prompt',
        best ? { verb: best.verb, label: best.label, id: best.id } : null,
      );
    }
  }

  private useInteractable(def: InteractableDef): void {
    // Gated on an item she does not have.
    if (def.requiresItem && !this.state.hasItem(def.requiresItem)) {
      this.audio.synth.denied();
      if (def.lockedTextId) this.showText(def.lockedTextId, false);
      return;
    }

    switch (def.kind) {
      case 'puzzle': {
        this.usePuzzle(def);
        return;
      }
      case 'door': {
        if (def.exitTo) {
          this.audio.synth.door(true);
          this.player.playInteract(0.3);
          this.transitionTo(def.exitTo, def.exitSpawn ?? 'default');
          return;
        }
        break;
      }
      default:
        break;
    }

    this.player.playInteract(0.42, def.kind === 'pickup' ? 'reach' : 'interact');

    if (def.itemId) {
      if (this.state.addItem(def.itemId)) {
        this.audio.synth.pickup();
        this.events.emit('item', { itemId: def.itemId });
        if (def.itemId === 'item-lantern') {
          this.player.lantern.found = true;
        }
      }
    } else {
      this.audio.synth.interact();
    }

    if (def.clueId && this.state.addClue(def.clueId)) {
      this.audio.synth.clue();
      this.events.emit('clue', { clueId: def.clueId });
    }
    if (def.setsFlag) this.state.setFlag(def.setsFlag);
    if (def.once) this.state.setFlag(`used:${def.id}`);
    if (def.textId) this.showText(def.textId, false);

    this.view.refreshLamps((flag) => this.state.hasFlag(flag));
    this.events.emit('autosave', { reason: `interact:${def.id}` });
  }

  private usePuzzle(def: InteractableDef): void {
    const id = def.puzzleId;
    if (!id) return;

    // The two endings are authored as "puzzles" so they share the gating,
    // prompt and once-only machinery with everything else.
    if (id === 'ending-shown') {
      this.state.setFlag(`used:${def.id}`);
      this.startCinematic('ending-shown');
      return;
    }

    this.player.playInteract(0.36);

    if (id === 'puzzle-sluice') {
      const index = Number.parseInt(def.id.split('-').pop() ?? '0', 10);
      this.puzzles.sluice.input(this.puzzleCtx, { dial: Number.isFinite(index) ? index : 0 });
      return;
    }
    if (id === 'puzzle-counterweight') {
      const railLit = this.isRailLit();
      this.puzzles.counterweight.input(this.puzzleCtx, { kind: 'crank', lit: railLit });
      if (!railLit) this.showHintOnce('counterweight-hint', 'tunnels-cart');
      return;
    }
  }

  private shownHints = new Set<string>();

  private showHintOnce(key: string, textId: string): void {
    if (this.shownHints.has(key)) return;
    this.shownHints.add(key);
    this.showText(textId, false);
  }

  /** Is the beam on the cart rail? Drives the counterweight puzzle. */
  private isRailLit(): boolean {
    const rail = this.world.all.find((c) => c.id === 'cart-rail');
    if (!rail) return false;
    const cone = this.beamCone;
    return cone.length > 0 && coneRect(cone, rail);
  }

  // ------------------------------------------------------- per-scene puzzles

  private updateBridgePuzzle(): void {
    if (this.scene?.id !== 'highstreet') return;
    const onSpan = this.player.x > 1180 && this.player.x < 1600;
    const fell = onSpan && this.player.y > 90;
    this.puzzles.bridge.input(this.puzzleCtx, {
      onSpan,
      atFarSide: this.player.x > 1640 && this.player.y < 40,
      fell,
    });
  }

  private updateChalkPuzzle(): void {
    if (this.scene?.id !== 'ward') return;
    const section = Math.floor((this.player.x - WARD_START) / WARD_SECTION);
    if (section < 0) return;
    const lit = this.player.lantern.lit;
    this.puzzles.chalk.input(this.puzzleCtx, { section, lit });
    // The chalk's promise has to be true in the simulation, not just on paper:
    // lighting a cross section is what actually wakes the Drowned standing on
    // it, and that happens through the normal cone test in `Drowned.update`.
    void ChalkPuzzle.wakes(section, lit);
  }

  private onPuzzleSolved(id: string): void {
    this.audio.synth.solved();
    this.camera.shake(1.6, 0.5);
    this.events.emit('solved', { puzzleId: id });
    this.view.refreshLamps((flag) => this.state.hasFlag(flag));
    this.events.emit('autosave', { reason: `solved:${id}` });
  }

  private onPuzzleFeedback(id: string, kind: 'step' | 'reject' | 'progress'): void {
    if (kind === 'step') {
      if (id === 'puzzle-sluice') {
        this.audio.synth.detent(this.puzzles.sluice.dialAt(0));
      } else if (id === 'puzzle-counterweight') {
        this.audio.synth.mechanism(0.8, 1.2);
        this.camera.shake(0.8, 0.2);
      }
    } else if (kind === 'reject') {
      this.audio.synth.denied();
    } else if (kind === 'progress') {
      this.audio.synth.uiMove();
    }
  }

  // --------------------------------------------------------------- narration

  showText(textId: string, fromCinematic: boolean): void {
    this.pendingTextId = textId;
    this.textIsCinematic = fromCinematic;
    this.events.emit('showText', { textId, fromCinematic });
  }

  /** Called by the UI when the player dismisses narration. */
  dismissText(): void {
    this.pendingTextId = null;
    if (this.textIsCinematic || this.cinematic.playing) {
      this.cinematic.textDismissed();
    }
    this.textIsCinematic = false;
  }

  get textPending(): boolean {
    return this.pendingTextId !== null;
  }

  // -------------------------------------------------------------- cinematics

  startCinematic(id: string): void {
    const def = getCinematic(id);
    if (!def) return;
    this.state.setFlag(`cine:${id}`);
    this.cinematic.start(def);
    this.controls.setMovementLocked(true);
    this.events.emit('cinematic', { id, skippable: def.skippable ?? false });

    // The `ending` cinematic is a dispatcher: it resolves to whichever ending
    // the player's actions have earned.
    if (id === 'ending') {
      this.cinematic.stop();
      const chosen = this.state.hasFlag('ending-shown') ? 'ending-shown' : 'ending-withheld';
      this.startCinematic(chosen);
    }
  }

  skipCinematic(): void {
    if (!this.cinematic.playing || !this.cinematic.skippable) return;
    this.cinematic.skip((step) => this.applyCinematicStep(step));
    this.endCinematic();
  }

  private applyCinematicStep(step: CinematicStep): void {
    if (step.bars !== undefined) this.barsTarget = step.bars;
    if (step.fade !== undefined) this.fadeTarget = step.fade;
    if (step.camera) this.camera.setFraming(step.camera);
    if (step.releaseCamera) this.camera.setFraming(null);
    if (step.lock !== undefined) {
      this.lockedPose = step.lock;
      this.player.locked = step.lock;
    }
    if (step.pose) this.player.scriptedPose = step.pose;
    if (step.walkTo) this.walkTarget = step.walkTo;
    if (step.flag) this.state.setFlag(step.flag);
    if (step.shake) this.camera.shake(step.shake, 0.8);
    if (step.lantern === 'off') this.player.lantern.setOn(false);
    if (step.lantern === 'on') this.player.lantern.setOn(true);
    if (step.lantern === 'suppress') this.player.lantern.suppress(true);
    if (step.lantern === 'release') this.player.lantern.suppress(false);
    if (step.audio) this.playCue(step.audio);
    if (step.textId) this.showText(step.textId, true);
    if (step.ending) this.finish(step.ending);
  }

  private endCinematic(): void {
    this.barsTarget = 0;
    this.lockedPose = false;
    this.walkTarget = null;
    this.player.locked = false;
    this.camera.setFraming(null);
    this.controls.setMovementLocked(false);
    this.events.emit('cinematic', { id: null, skippable: false });
    this.events.emit('autosave', { reason: 'cinematic-end' });
  }

  private playCue(cue: string): void {
    switch (cue) {
      case 'choir-on':
        this.audio.startChoir(9, 98);
        break;
      case 'choir-off':
        this.audio.stopChoir();
        break;
      case 'swell':
        this.audio.synth.swell(5, 58);
        break;
      case 'flood-on':
        this.audio.startFlood();
        this.audio.setFlood(0.2);
        break;
      case 'flood-up':
        this.audio.setFlood(0.9);
        break;
      case 'gate-moving':
        this.audio.synth.mechanism(2.4, 0.5);
        break;
      default:
        break;
    }
  }

  // ------------------------------------------------------------------- death

  private onDrownedNoticed(_d: Drowned): void {
    this.audio.synth.noticed();
    this.camera.shake(1.1, 0.4);
  }

  private onTaken(_d: Drowned): void {
    this.die('taken');
  }

  die(reason: 'taken' | 'water'): void {
    if (this.dying) return;
    this.dying = true;
    this.deathReason = reason;
    this.dyingTimer = 1.9;
    this.state.deaths++;
    this.player.locked = true;
    this.controls.setMovementLocked(true);
    this.barsTarget = 1;
    if (reason === 'taken') {
      this.audio.synth.taken();
      this.camera.shake(4, 0.8);
    } else {
      this.audio.setFlood(1);
      this.camera.shake(2.5, 1);
    }
    this.events.emit('death', {
      reason,
      textId: reason === 'taken' ? 'death-taken' : 'death-drowned',
    });
  }

  /**
   * Returns to the last checkpoint.
   *
   * Deliberately cheap: the same scene, the same spawn, every Drowned back to
   * dormant, and the player keeps every clue and flag. A death costs about
   * fifteen seconds. The brief is explicit that threat sequences must support
   * retrying without frustrating repetition, and a horror game whose deaths
   * are expensive just teaches players to stop exploring.
   */
  private respawn(): void {
    this.dying = false;
    this.barsTarget = 0;
    this.fadeTarget = 0;
    this.controls.setMovementLocked(false);
    this.audio.stopChoir();

    const scene = this.state.checkpointScene;
    const spawn = this.state.checkpointSpawn;
    if (scene !== this.scene?.id) {
      this.loadScene(scene, spawn);
      return;
    }

    const point = this.scene.spawns[spawn] ?? this.scene.spawns.default;
    this.player.placeAt(point.x, point.y, point.facing, this.world, this.solidity);
    this.player.lantern.reset();
    this.player.lantern.found = this.state.hasItem('item-lantern');
    this.player.setDread(0);
    for (const d of this.drowned) d.restore();
    this.camera.snapTo(this.player.x, this.player.y);
    this.cinematic.stop();
    this.pendingTextId = null;
    void this.deathReason;
  }

  // ----------------------------------------------------------- transitions

  private transitioning = false;

  transitionTo(sceneId: SceneId, spawnId: string): void {
    if (this.transitioning) return;
    this.transitioning = true;
    this.fadeTarget = 1;
    this.controls.setMovementLocked(true);
    // Fade out, swap, fade in. Keeping the swap on a timer rather than on the
    // fade's own completion means a dropped frame cannot leave the player
    // stuck behind a black screen.
    window.setTimeout(() => {
      this.loadScene(sceneId, spawnId);
      this.fadeTarget = 0;
      this.controls.setMovementLocked(false);
      this.transitioning = false;
    }, 460);
  }

  private finish(endingId: string): void {
    this.state.completed = true;
    this.state.endingId = endingId;
    this.state.setFlag('completed');
    this.audio.silence();
    this.events.emit('ending', { endingId });
    this.events.emit('autosave', { reason: 'ending' });
  }

  // ------------------------------------------------------------------ audio

  private surfaceAt(): 'silt' | 'stone' | 'boards' | 'water' | 'metal' {
    const id = this.scene?.id;
    if (id === 'shore') return this.player.x > 1900 && this.player.x < 2400 ? 'water' : 'silt';
    if (id === 'highstreet') return this.player.y > 100 ? 'water' : 'stone';
    if (id === 'ward') return 'boards';
    if (id === 'tunnels') return 'metal';
    if (id === 'gatehouse') return 'boards';
    return 'silt';
  }

  private onFootstep(state: string): void {
    const weight = state === 'run' ? 1.2 : state === 'crouchwalk' ? 0.5 : 0.85;
    this.audio.synth.footstep(this.surfaceAt(), weight);
  }

  private onLanded(impact: number): void {
    if (impact < 200) return;
    this.audio.synth.footstep(this.surfaceAt(), 1.4);
    this.camera.shake(clamp(impact / 500, 0.3, 2.2), 0.22);
    if (impact > 620) this.player.stagger(this.player.x, 0.6);
  }

  // ------------------------------------------------------------------ saving

  /** Snapshot for the save system. */
  snapshot(): {
    sceneId: SceneId;
    spawnId: string;
    chapter: number;
    checkpointScene: SceneId;
    checkpointSpawn: string;
    playerX: number | null;
    playerY: number | null;
    playerFacing: Facing;
    flags: string[];
    clues: string[];
    items: string[];
    puzzles: Record<string, Record<string, number | string | boolean>>;
    playTime: number;
    completed: boolean;
    endingId: string | null;
    deaths: number;
  } {
    const safe = this.player.body.onGround && !this.dying && !this.cinematic.playing;
    return {
      sceneId: this.state.sceneId,
      spawnId: this.state.spawnId,
      chapter: this.state.chapter,
      checkpointScene: this.state.checkpointScene,
      checkpointSpawn: this.state.checkpointSpawn,
      // Only ever persist a position the player is actually standing on.
      playerX: safe ? Math.round(this.player.x) : null,
      playerY: safe ? Math.round(this.player.y) : null,
      playerFacing: this.player.facing,
      flags: [...this.state.allFlags],
      clues: [...this.state.allClues],
      items: [...this.state.allItems],
      puzzles: this.state.allPuzzles as Record<string, Record<string, number | string | boolean>>,
      playTime: this.state.playTime,
      completed: this.state.completed,
      endingId: this.state.endingId,
      deaths: this.state.deaths,
    };
  }

  /** Places the player at a restored mid-scene position when it is safe. */
  restorePosition(x: number | null, y: number | null, facing: Facing): void {
    if (x === null || y === null || !this.scene) return;
    const b = this.scene.bounds;
    if (x < b.x || x > b.x + b.w || y < b.y || y > b.y + b.h) return;
    this.player.placeAt(x, y, facing, this.world, this.solidity);
    this.camera.snapTo(this.player.x, this.player.y);
  }

  destroy(): void {
    this.unloadScene();
    this.player.destroy();
    this.events.clear();
  }
}
