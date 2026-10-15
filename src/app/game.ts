import { Application } from 'pixi.js';
import { FIXED_DT, GameLoop } from '@/core/clock';
import { GameAudio } from '@/audio';
import { Controls } from '@/input/controls';
import { Director } from '@/gameplay/director';
import { resetScripts } from '@/gameplay/scripts';
import { SceneView } from '@/rendering/scene-view';
import { SaveStore } from '@/persistence/store';
import { DEFAULT_SETTINGS, type SaveData, type SaveSettings } from '@/persistence/schema';
import { CLUES } from '@/narrative/clues';
import { getText } from '@/narrative/text';
import { Hud } from '@/ui/hud';
import { Screens } from '@/ui/screens';
import { ChapterCard, Narration } from '@/ui/narration';
import { el } from '@/ui/dom';
import {
  attachLifecycle,
  renderResolution,
  requestFullscreen,
  requestLandscapeImmersive,
  watchOrientation,
} from '@/mobile/platform';
import type { SceneId } from '@/world/types';

type Mode = 'boot' | 'title' | 'playing' | 'paused' | 'ended';

/**
 * Application shell.
 *
 * Owns the PixiJS application, the loop, the save store and the UI, and wires
 * them to the Director. Deliberately the only module that knows about all of
 * them: everything below this is independently testable.
 */
export class Game {
  private readonly app = new Application();
  private readonly view = new SceneView();
  private readonly audio = new GameAudio();
  private readonly store = new SaveStore();

  private hud!: Hud;
  private screens!: Screens;
  private narration!: Narration;
  private chapterCard!: ChapterCard;
  private fadeEl!: HTMLElement;
  private skipEl!: HTMLButtonElement;
  private perfEl!: HTMLElement;
  private controls!: Controls;
  private director!: Director;
  private loop!: GameLoop;

  private mode: Mode = 'boot';
  private settings: SaveSettings = { ...DEFAULT_SETTINGS };
  private detachLifecycle: (() => void) | null = null;
  private detachOrientation: (() => void) | null = null;
  private saveTimer = 0;
  private savePending = false;
  private lastSaveAt = 0;
  private showPerf = false;

  async start(stageRoot: HTMLElement, uiRoot: HTMLElement): Promise<void> {
    this.settings = await this.store.loadSettings();

    await this.app.init({
      background: 0x05080b,
      antialias: false,
      resolution: renderResolution(this.settings.lowQuality),
      autoDensity: true,
      // No `powerPreference: 'high-performance'` and no `resizeTo`.
      // On the Android 14 WebView both were tested on device: with them, the
      // renderer produced correct pixels (verified by extract) but the canvas
      // never composited, so the player saw a black world under a working
      // HUD. Resizing is handled by onResize below instead.
      // The loop drives rendering; Pixi's own ticker would double-step it.
      autoStart: false,
      preference: 'webgl',
    });
    stageRoot.append(this.app.canvas);
    this.app.stage.addChild(this.view.root);

    this.buildUi(uiRoot);
    this.applySettings(this.settings);

    this.director = new Director(this.view, this.audio, this.controls);
    this.bindDirector();

    this.loop = new GameLoop({
      fixedUpdate: (dt) => this.fixedUpdate(dt),
      render: (dt) => this.render(dt),
    });

    window.addEventListener('resize', this.onResize);
    this.onResize();

    this.detachOrientation = watchOrientation();
    // Lifecycle wiring is an enhancement, never a precondition: a failure here
    // must not stop the game from starting.
    try {
      this.detachLifecycle = attachLifecycle({
        onPause: () => void this.onAppPause(),
        onResume: () => void this.onAppResume(),
        onBack: () => this.onBackButton(),
      });
    } catch (err) {
      console.warn('[lifecycle] unavailable', err);
    }

    await this.refreshContinue();
    this.mode = 'title';
    this.screens.showTitle();
    this.hud.setVisible(false);
    this.loop.start();
  }

  // --------------------------------------------------------------------- UI

  private buildUi(uiRoot: HTMLElement): void {
    this.fadeEl = el('div', { class: 'fade' });
    this.narration = new Narration();
    this.chapterCard = new ChapterCard();

    this.hud = new Hud({
      onLantern: () => undefined,
      onInteract: () => undefined,
      onPause: () => this.pause(),
      onJournal: () => this.openJournal(),
    });

    this.skipEl = el('button', { class: 'skip', type: 'button', text: 'Skip' });
    this.skipEl.addEventListener('click', () => this.director.skipCinematic());

    this.perfEl = el('div', { class: 'perf', hidden: true });

    this.screens = new Screens(
      {
        onNewGame: () => void this.newGame(),
        onContinue: () => void this.continueGame(),
        onResume: () => this.resume(),
        onOpenSettings: () => this.screens.showSettings(),
        onCloseSettings: () => {
          this.screens.hideSettings();
          void this.store.saveSettings(this.settings);
          if (this.mode === 'title') this.screens.showTitle();
        },
        onRestartChapter: () => this.restartFromCheckpoint(),
        onQuitToTitle: () => void this.quitToTitle(),
        onCloseJournal: () => this.closeJournal(),
        onSettingsChanged: (s) => this.applySettings(s),
        onCredits: () => this.screens.showCredits(),
        onEndingContinue: () => this.screens.showCredits(),
        uiMove: () => this.audio.synth.uiMove(),
        uiConfirm: () => this.audio.synth.uiConfirm(),
        uiBack: () => this.audio.synth.uiBack(),
      },
      this.settings,
    );

    const rotate = el('div', { class: 'rotate' }, [
      el('div', {}, [
        el('div', { class: 'rotate__icon', text: '▭' }),
        el('div', { class: 'rotate__text', text: 'Please turn your device sideways.' }),
      ]),
    ]);

    uiRoot.append(
      this.hud.root,
      this.narration.root,
      this.chapterCard.root,
      this.screens.root,
      this.skipEl,
      this.perfEl,
      this.fadeEl,
      rotate,
    );

    this.controls = new Controls(this.hud.touchSurface, this.hud.stickVisual);
    const b = this.hud.buttons;
    this.controls.bindButton(b.lantern, 'lantern');
    this.controls.bindButton(b.interact, 'interact');

    // Any first interaction unlocks audio, which mobile requires.
    const unlock = (): void => {
      void this.audio.unlock().then(() => this.audio.setLevels(this.settings));
    };
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });

    // Keyboard: dismiss narration, toggle the perf overlay.
    window.addEventListener('keydown', (e) => {
      if (this.narration.isOpen && (e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyE')) {
        e.preventDefault();
        this.narration.advance();
      }
      if (e.code === 'F3' || (e.code === 'KeyF' && e.shiftKey)) {
        this.showPerf = !this.showPerf;
        this.perfEl.hidden = !this.showPerf;
      }
    });
  }

  private applySettings(settings: SaveSettings): void {
    this.settings = settings;
    this.audio.setLevels(settings);
    this.view.setLowQuality(settings.lowQuality);
    document.body.classList.toggle('large-text', settings.largeText);
    this.hud.setHintsEnabled(settings.showHints);
    if (this.app.renderer) {
      const target = renderResolution(settings.lowQuality);
      if (Math.abs(this.app.renderer.resolution - target) > 0.01) {
        this.app.renderer.resolution = target;
        this.onResize();
      }
    }
    void this.store.saveSettings(settings);
  }

  private bindDirector(): void {
    const d = this.director;

    d.events.on('showText', ({ textId }) => {
      if (!getText(textId)) {
        d.dismissText();
        return;
      }
      this.hud.setDimmed(true);
      this.narration.show(textId, () => {
        this.hud.setDimmed(false);
        d.dismissText();
      });
    });

    d.events.on('prompt', (prompt) => this.hud.setPrompt(prompt));
    d.events.on('clue', ({ clueId }) => this.hud.showClue(clueId));
    d.events.on('item', ({ itemId }) => this.hud.showItem(itemId));

    d.events.on('chapter', ({ title, subtitle }) => {
      this.chapterCard.show(title, subtitle);
    });

    d.events.on('fade', ({ amount }) => {
      this.fadeEl.style.opacity = String(amount);
    });

    d.events.on('death', ({ textId }) => {
      // The death line is shown on the black, not over the world.
      window.setTimeout(() => {
        const entry = getText(textId);
        if (entry) this.chapterCard.show(entry.lines[0] ?? '', '', 1600);
      }, 700);
    });

    d.events.on('cinematic', ({ id, skippable }) => {
      this.hud.setDimmed(id !== null);
      this.skipEl.classList.toggle('is-visible', id !== null && skippable);
    });

    d.events.on('ending', ({ endingId }) => {
      this.mode = 'ended';
      this.hud.setVisible(false);
      this.chapterCard.hide();
      void this.save('ending');
      window.setTimeout(() => {
        this.fadeEl.style.opacity = '0';
        this.screens.showEnding({
          endingId,
          playTime: d.state.playTime,
          clues: d.state.clueCount,
          deaths: d.state.deaths,
        });
      }, 900);
    });

    d.events.on('autosave', ({ reason }) => this.requestSave(reason));
  }

  // ------------------------------------------------------------------ frames

  private fixedUpdate(dt: number): void {
    if (this.mode !== 'playing') return;
    const input = this.controls.sample();

    if (input.pausePressed) {
      this.pause();
      this.controls.endFrame();
      return;
    }
    if (input.journalPressed) {
      this.openJournal();
      this.controls.endFrame();
      return;
    }

    this.director.fixedUpdate(dt);
    this.controls.endFrame();

    this.hud.setLanternOn(
      this.director.player.lantern.on,
      this.director.player.lantern.found,
    );
  }

  private render(dt: number): void {
    if (this.mode === 'playing' || this.mode === 'paused') {
      this.director.render(dt);
    }
    this.app.render();
    if (this.showPerf) this.updatePerf();

    // Deferred save, so a burst of flags costs one write.
    if (this.savePending && performance.now() - this.saveTimer > 900) {
      this.savePending = false;
      void this.save('deferred');
    }
  }

  private updatePerf(): void {
    const s = this.loop.stats;
    const d = this.director;
    this.perfEl.textContent = [
      `fps    ${s.fps.toFixed(1)}`,
      `frame  ${s.frameMs.toFixed(1)}ms`,
      `steps  ${s.simSteps}`,
      `stalls ${s.stallCount}`,
      `scene  ${d.currentScene?.id ?? '-'}`,
      `pos    ${Math.round(d.player.x)},${Math.round(d.player.y)}`,
      `state  ${d.player.state}`,
      `lamp   ${d.player.lantern.on ? 'on' : 'off'} ${d.player.lantern.intensity.toFixed(2)}`,
      `dread  ${d.player.dread.toFixed(2)}`,
      `clues  ${d.state.clueCount}/${CLUES.length}`,
      `res    ${this.app.renderer.resolution.toFixed(1)}`,
    ].join('\n');
  }

  private onResize = (): void => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.app.renderer.resize(w, h);
    this.director?.resize(w, h);
  };

  // ------------------------------------------------------------- game states

  private async newGame(): Promise<void> {
    await this.audio.unlock();
    this.audio.setLevels(this.settings);
    await requestLandscapeImmersive();
    void requestFullscreen();

    resetScripts();
    this.director.state.reset();
    this.director.puzzles.resetAll({
      state: this.director.state,
      onSolved: () => undefined,
      onFeedback: () => undefined,
    });
    // resetAll clears the solved flags it set; reset the state again so a new
    // game cannot inherit a previous run's flags.
    this.director.state.reset();

    this.screens.closeAll();
    this.hud.setVisible(true);
    this.mode = 'playing';
    this.director.setPaused(false);
    this.director.loadScene('shore', 'default');
    await this.save('new-game');
  }

  private async continueGame(): Promise<void> {
    const data = await this.store.load();
    if (!data) {
      await this.newGame();
      return;
    }
    await this.audio.unlock();
    this.audio.setLevels(this.settings);
    await requestLandscapeImmersive();
    void requestFullscreen();

    resetScripts();
    this.director.state.reset();
    this.director.state.hydrate({
      flags: data.flags,
      clues: data.clues,
      items: data.items,
      puzzles: data.puzzles,
      sceneId: data.sceneId,
      spawnId: data.spawnId,
      chapter: data.chapter,
      checkpointScene: data.checkpointScene,
      checkpointSpawn: data.checkpointSpawn,
      playTime: data.playTime,
      completed: data.completed,
      endingId: data.endingId,
      deaths: data.deaths,
    });

    this.screens.closeAll();
    this.hud.setVisible(true);
    this.mode = 'playing';
    this.director.setPaused(false);
    // Always load the checkpoint scene: it is the only position guaranteed to
    // be valid against the current collision data.
    this.director.loadScene(data.checkpointScene, data.checkpointSpawn);
    if (data.sceneId === data.checkpointScene) {
      this.director.restorePosition(data.playerX, data.playerY, data.playerFacing);
    }
  }

  private pause(): void {
    if (this.mode !== 'playing') return;
    if (this.narration.isOpen) return;
    this.mode = 'paused';
    this.director.setPaused(true);
    this.audio.synth.uiBack();
    this.screens.showPause();
    this.hud.setVisible(false);
    void this.save('pause');
  }

  private resume(): void {
    if (this.mode !== 'paused') return;
    this.screens.closeAll();
    this.hud.setVisible(true);
    this.mode = 'playing';
    this.director.setPaused(false);
    this.loop.resetTiming();
  }

  private openJournal(): void {
    if (this.mode === 'playing') {
      this.mode = 'paused';
      this.director.setPaused(true);
      this.hud.setVisible(false);
    }
    this.screens.openJournal({
      clues: this.director.state.allClues,
      items: this.director.state.allItems,
    });
  }

  private closeJournal(): void {
    this.screens.hideJournal();
    if (this.mode === 'paused') this.screens.showPause();
  }

  private restartFromCheckpoint(): void {
    this.screens.closeAll();
    this.hud.setVisible(true);
    this.mode = 'playing';
    this.director.setPaused(false);
    this.loop.resetTiming();
    this.director.loadScene(
      this.director.state.checkpointScene,
      this.director.state.checkpointSpawn,
    );
  }

  private async quitToTitle(): Promise<void> {
    // Only a run in progress has anything to save. Credits can be opened from
    // the title screen, where the director holds no game - saving there would
    // overwrite the player's real save with an empty one.
    if (this.mode === 'playing' || this.mode === 'paused' || this.mode === 'ended') {
      await this.save('quit');
    }
    this.audio.silence();
    resetScripts();
    this.director.setPaused(true);
    this.view.unload();
    this.mode = 'title';
    this.hud.setVisible(false);
    this.chapterCard.hide();
    this.fadeEl.style.opacity = '0';
    await this.refreshContinue();
    this.screens.showTitle();
  }

  private onBackButton(): boolean {
    if (this.narration.isOpen) {
      this.narration.advance();
      return true;
    }
    if (this.screens.journalOpen) {
      this.closeJournal();
      return true;
    }
    if (this.screens.settingsOpen) {
      this.screens.hideSettings();
      if (this.mode === 'title') this.screens.showTitle();
      return true;
    }
    if (this.screens.pauseOpen) {
      this.resume();
      return true;
    }
    if (this.mode === 'playing') {
      this.pause();
      return true;
    }
    // Credits and the ending are reached from the title or the end of a run;
    // Back returns to the title rather than dropping out of the app.
    if (!this.screens.titleOpen && this.screens.anyOpen) {
      void this.quitToTitle();
      return true;
    }
    // On the title screen itself, let the platform exit.
    return false;
  }

  // ----------------------------------------------------------------- saving

  private requestSave(_reason: string): void {
    this.savePending = true;
    this.saveTimer = performance.now();
  }

  /**
   * Writes the save.
   *
   * Rate-limited to one write every 1.5s outside of explicit moments, because
   * the brief is explicit about avoiding excessive storage writes during
   * active gameplay - and an IndexedDB transaction per flag would cost frames.
   */
  private async save(reason: string): Promise<boolean> {
    const forced = reason === 'pause' || reason === 'background' || reason === 'ending' || reason === 'quit';
    const now = performance.now();
    if (!forced && now - this.lastSaveAt < 1500) {
      this.savePending = true;
      return false;
    }
    this.lastSaveAt = now;
    const snapshot = this.director.snapshot();
    const data: SaveData = {
      version: 0,
      savedAt: Date.now(),
      ...snapshot,
    };
    const ok = await this.store.save(data);
    if (this.store.lastError) this.screens.setStorageNote(this.store.lastError);
    return ok;
  }

  private async refreshContinue(): Promise<void> {
    const data = await this.store.load();
    this.screens.setContinueAvailable(data !== null, data?.savedAt ?? 0, data?.chapter ?? 1);
    this.screens.setStorageNote(this.store.lastError);
  }

  // -------------------------------------------------------------- lifecycle

  private async onAppPause(): Promise<void> {
    if (this.mode === 'playing') {
      this.mode = 'paused';
      this.director.setPaused(true);
      this.screens.showPause();
      this.hud.setVisible(false);
    }
    await this.save('background');
    await this.audio.suspend();
    this.loop.stop();
  }

  private async onAppResume(): Promise<void> {
    this.loop.resetTiming();
    this.loop.start();
    await this.audio.resume();
    this.audio.setLevels(this.settings);
  }

  /** Current scene, for the automated smoke test hook. */
  get debugState(): {
    mode: Mode;
    scene: SceneId | null;
    clues: number;
    fps: number;
    playerX: number;
    playerY: number;
    playerState: string;
    lanternOn: boolean;
    lanternFound: boolean;
    cinematic: boolean;
    narration: boolean;
    chapterCard: boolean;
    busy: boolean;
  } {
    const d = this.director;
    const cinematic = d?.cinematic.playing ?? false;
    const narration = this.narration?.isOpen ?? false;
    const card = this.chapterCard?.root.classList.contains('is-visible') ?? false;
    return {
      mode: this.mode,
      scene: d?.currentScene?.id ?? null,
      clues: d?.state.clueCount ?? 0,
      fps: this.loop?.stats.fps ?? 0,
      playerX: d?.player.x ?? 0,
      playerY: d?.player.y ?? 0,
      playerState: d?.player.state ?? 'none',
      lanternOn: d?.player.lantern.on ?? false,
      lanternFound: d?.player.lantern.found ?? false,
      cinematic,
      narration,
      chapterCard: card,
      // True while the game is not accepting ordinary gameplay input.
      busy: cinematic || narration || card,
    };
  }

  /** Test hook: reports what the renderer actually built for this scene. */
  debugLayers(): unknown {
    return this.view.describeLayers();
  }

  /** Test hook: jump straight to a scene, with the lantern in hand. */
  debugGoto(scene: SceneId, spawn = 'default'): void {
    if (this.mode === 'title') {
      this.screens.closeAll();
      this.hud.setVisible(true);
      this.mode = 'playing';
      this.director.state.reset();
      this.director.setPaused(false);
    }
    // Every chapter past the prologue assumes the lamp, and a tester dropped
    // into one without it cannot exercise anything, so the hook grants it.
    this.director.state.addItem('item-lantern');
    this.director.loadScene(scene, spawn);
  }

  destroy(): void {
    this.loop?.stop();
    window.removeEventListener('resize', this.onResize);
    this.detachLifecycle?.();
    this.detachOrientation?.();
    this.controls?.dispose();
    this.director?.destroy();
    this.view.destroy();
    this.audio.destroy();
    this.app.destroy(true, { children: true });
  }
}

export const FIXED_STEP = FIXED_DT;
