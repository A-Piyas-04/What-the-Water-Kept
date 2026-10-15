import { clamp } from './math';

export interface LoopStats {
  fps: number;
  frameMs: number;
  simSteps: number;
  worstFrameMs: number;
  stallCount: number;
}

export interface LoopCallbacks {
  /** Fixed-step gameplay simulation. `dt` is always FIXED_DT. */
  fixedUpdate: (dt: number) => void;
  /** Variable-step visual update. `alpha` is the interpolation factor. */
  render: (dt: number, alpha: number) => void;
}

/** 60 Hz simulation. Decoupled from the display refresh rate. */
export const FIXED_DT = 1 / 60;
/** Never run more than this many sim steps for one displayed frame. */
const MAX_STEPS_PER_FRAME = 5;
/** Frame times above this are treated as a stall and discarded, not caught up. */
const MAX_FRAME_DT = 0.25;

/**
 * Fixed-timestep loop with a bounded accumulator.
 *
 * A bounded accumulator is what keeps a frame stall (a GC pause, the Android
 * WebView being backgrounded, a scene load) from turning into a burst of
 * catch-up steps that teleport the player through a wall.
 */
export class GameLoop {
  private accumulator = 0;
  private lastTime = 0;
  private rafId = 0;
  private running = false;

  private fpsAccum = 0;
  private fpsFrames = 0;
  readonly stats: LoopStats = {
    fps: 0,
    frameMs: 0,
    simSteps: 0,
    worstFrameMs: 0,
    stallCount: 0,
  };

  constructor(private readonly callbacks: LoopCallbacks) {}

  get isRunning(): boolean {
    return this.running;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.accumulator = 0;
    this.rafId = requestAnimationFrame(this.tick);
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }

  /**
   * Called when the app resumes from the background. Drops the elapsed wall
   * time so the simulation does not try to replay minutes of missed frames.
   */
  resetTiming(): void {
    this.lastTime = performance.now();
    this.accumulator = 0;
  }

  private tick = (now: number): void => {
    if (!this.running) return;
    this.rafId = requestAnimationFrame(this.tick);

    const rawDt = (now - this.lastTime) / 1000;
    this.lastTime = now;

    this.stats.frameMs = rawDt * 1000;
    if (rawDt * 1000 > this.stats.worstFrameMs) this.stats.worstFrameMs = rawDt * 1000;

    let dt = rawDt;
    if (dt > MAX_FRAME_DT) {
      // A genuine stall: skip the missing time instead of simulating it.
      this.stats.stallCount++;
      dt = FIXED_DT;
      this.accumulator = 0;
    }

    this.accumulator += clamp(dt, 0, MAX_FRAME_DT);

    let steps = 0;
    while (this.accumulator >= FIXED_DT && steps < MAX_STEPS_PER_FRAME) {
      this.callbacks.fixedUpdate(FIXED_DT);
      this.accumulator -= FIXED_DT;
      steps++;
    }
    if (steps >= MAX_STEPS_PER_FRAME) this.accumulator = 0;
    this.stats.simSteps = steps;

    this.callbacks.render(rawDt, this.accumulator / FIXED_DT);

    this.fpsAccum += rawDt;
    this.fpsFrames++;
    if (this.fpsAccum >= 0.5) {
      this.stats.fps = this.fpsFrames / this.fpsAccum;
      this.fpsAccum = 0;
      this.fpsFrames = 0;
      this.stats.worstFrameMs = 0;
    }
  };
}

/** Simple monotonic timer for cinematics and cooldowns. */
export class Timer {
  private remaining = 0;

  set(seconds: number): void {
    this.remaining = seconds;
  }

  get active(): boolean {
    return this.remaining > 0;
  }

  get left(): number {
    return Math.max(0, this.remaining);
  }

  /** Returns true on the step the timer completes. */
  tick(dt: number): boolean {
    if (this.remaining <= 0) return false;
    this.remaining -= dt;
    return this.remaining <= 0;
  }

  clear(): void {
    this.remaining = 0;
  }
}
