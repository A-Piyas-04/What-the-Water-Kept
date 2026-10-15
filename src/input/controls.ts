import { clamp } from '@/core/math';
import {
  CROUCH_THRESHOLD,
  RUN_THRESHOLD,
  type InputState,
  clearEdges,
  makeInputState,
} from './state';

const DEAD_ZONE = 0.14;
const STICK_RADIUS = 58;

/**
 * Input, from touch or keyboard, into one `InputState`.
 *
 * Touch layout: the left half of the screen is a floating thumbstick that
 * appears wherever the thumb lands, and the right side carries the lantern and
 * context buttons. Pushing the stick past a threshold runs and pulling it down
 * crouches, which removes two buttons from the screen - on a phone, every
 * control you can delete is a win.
 */
export class Controls {
  readonly state: InputState = makeInputState();

  private stickId: number | null = null;
  private stickOriginX = 0;
  private stickOriginY = 0;
  private stickX = 0;
  private stickY = 0;

  private readonly keys = new Set<string>();
  private readonly buttons = new Map<string, { held: boolean; pressed: boolean }>();
  private disposers: Array<() => void> = [];
  private enabled = true;
  /** Suppresses movement during cinematics but keeps menu input alive. */
  private movementLocked = false;

  constructor(
    private readonly surface: HTMLElement,
    private readonly stickVisual: {
      show: (x: number, y: number) => void;
      move: (dx: number, dy: number) => void;
      hide: () => void;
    },
  ) {
    this.attach();
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) this.releaseAll();
  }

  setMovementLocked(locked: boolean): void {
    this.movementLocked = locked;
    if (locked) {
      this.stickId = null;
      this.stickX = 0;
      this.stickY = 0;
      this.stickVisual.hide();
    }
  }

  /** Registers a DOM button. Returns a disposer. */
  bindButton(el: HTMLElement, name: string): () => void {
    this.buttons.set(name, { held: false, pressed: false });
    const entry = this.buttons.get(name)!;

    const down = (e: PointerEvent): void => {
      e.preventDefault();
      e.stopPropagation();
      if (!this.enabled) return;
      entry.held = true;
      entry.pressed = true;
      el.classList.add('is-active');
      el.setPointerCapture?.(e.pointerId);
    };
    const up = (e: PointerEvent): void => {
      e.preventDefault();
      e.stopPropagation();
      entry.held = false;
      el.classList.remove('is-active');
      el.releasePointerCapture?.(e.pointerId);
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('pointerleave', up);
    const dispose = (): void => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      el.removeEventListener('pointerleave', up);
      this.buttons.delete(name);
    };
    this.disposers.push(dispose);
    return dispose;
  }

  private attach(): void {
    const onPointerDown = (e: PointerEvent): void => {
      if (!this.enabled || this.movementLocked) return;
      // Only the left half drives the stick, so the right thumb stays free.
      if (e.clientX > this.surface.clientWidth * 0.5) return;
      e.preventDefault();
      this.stickId = e.pointerId;
      this.stickOriginX = e.clientX;
      this.stickOriginY = e.clientY;
      this.stickX = 0;
      this.stickY = 0;
      this.stickVisual.show(e.clientX, e.clientY);
      this.surface.setPointerCapture?.(e.pointerId);
    };

    const onPointerMove = (e: PointerEvent): void => {
      if (e.pointerId !== this.stickId) return;
      e.preventDefault();
      let dx = e.clientX - this.stickOriginX;
      let dy = e.clientY - this.stickOriginY;
      const len = Math.hypot(dx, dy);
      if (len > STICK_RADIUS) {
        // Drag the origin along so the stick never feels stuck at full tilt.
        const over = len - STICK_RADIUS;
        this.stickOriginX += (dx / len) * over;
        this.stickOriginY += (dy / len) * over;
        dx = (dx / len) * STICK_RADIUS;
        dy = (dy / len) * STICK_RADIUS;
      }
      this.stickX = dx / STICK_RADIUS;
      this.stickY = dy / STICK_RADIUS;
      this.stickVisual.move(dx, dy);
    };

    const onPointerUp = (e: PointerEvent): void => {
      if (e.pointerId !== this.stickId) return;
      this.stickId = null;
      this.stickX = 0;
      this.stickY = 0;
      this.stickVisual.hide();
    };

    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.repeat) return;
      this.keys.add(e.code);
      // Space and the arrows must not scroll or re-trigger the page.
      if (
        ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)
      ) {
        e.preventDefault();
      }
      if (e.code === 'Space' || e.code === 'KeyF') this.state.lanternPressed = true;
      if (e.code === 'KeyE' || e.code === 'Enter') this.state.interactPressed = true;
      if (e.code === 'Escape' || e.code === 'KeyP') this.state.pausePressed = true;
      if (e.code === 'KeyJ' || e.code === 'KeyI' || e.code === 'Tab') {
        this.state.journalPressed = true;
      }
    };
    const onKeyUp = (e: KeyboardEvent): void => {
      this.keys.delete(e.code);
    };

    // Stop the WebView from treating gameplay drags as page gestures.
    const blockGesture = (e: Event): void => e.preventDefault();

    this.surface.addEventListener('pointerdown', onPointerDown, { passive: false });
    window.addEventListener('pointermove', onPointerMove, { passive: false });
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    this.surface.addEventListener('touchstart', blockGesture, { passive: false });
    this.surface.addEventListener('touchmove', blockGesture, { passive: false });
    this.surface.addEventListener('contextmenu', blockGesture);
    window.addEventListener('blur', this.releaseAll);

    this.disposers.push(() => {
      this.surface.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      this.surface.removeEventListener('touchstart', blockGesture);
      this.surface.removeEventListener('touchmove', blockGesture);
      this.surface.removeEventListener('contextmenu', blockGesture);
      window.removeEventListener('blur', this.releaseAll);
    });
  }

  private releaseAll = (): void => {
    this.keys.clear();
    this.stickId = null;
    this.stickX = 0;
    this.stickY = 0;
    this.stickVisual.hide();
    for (const b of this.buttons.values()) b.held = false;
  };

  private key(...codes: string[]): boolean {
    return codes.some((c) => this.keys.has(c));
  }

  /** Folds touch and keyboard into `state`. Call once per frame, before sim. */
  sample(): InputState {
    const s = this.state;

    let kx = 0;
    let ky = 0;
    if (this.key('ArrowLeft', 'KeyA')) kx -= 1;
    if (this.key('ArrowRight', 'KeyD')) kx += 1;
    if (this.key('ArrowUp', 'KeyW')) ky -= 1;
    if (this.key('ArrowDown', 'KeyS')) ky += 1;

    const usingKeys = kx !== 0 || ky !== 0;
    let mx = usingKeys ? kx : this.stickX;
    let my = usingKeys ? ky : this.stickY;

    const mag = Math.min(1, Math.hypot(mx, my));
    if (mag < DEAD_ZONE) {
      mx = 0;
      my = 0;
    }

    if (this.movementLocked) {
      mx = 0;
      my = 0;
    }

    s.moveX = clamp(mx, -1, 1);
    s.moveY = clamp(my, -1, 1);
    s.magnitude = this.movementLocked ? 0 : mag;
    s.touching = this.stickId !== null;

    const keyRun = this.key('ShiftLeft', 'ShiftRight');
    const keyCrouch = this.key('ControlLeft', 'ControlRight', 'KeyC');

    // Horizontal push past the threshold means run; a downward pull crouches.
    s.run = !this.movementLocked && (keyRun || Math.abs(mx) >= RUN_THRESHOLD);
    s.crouch =
      !this.movementLocked &&
      (keyCrouch || (my >= CROUCH_THRESHOLD && Math.abs(mx) < 0.85) || this.heldButton('crouch'));
    s.up = my <= -0.45;
    s.down = my >= 0.45;

    for (const [name, entry] of this.buttons) {
      if (entry.pressed) {
        entry.pressed = false;
        if (name === 'lantern') s.lanternPressed = true;
        else if (name === 'interact') s.interactPressed = true;
        else if (name === 'pause') s.pausePressed = true;
        else if (name === 'journal') s.journalPressed = true;
      }
    }
    s.interactHeld = this.heldButton('interact') || this.key('KeyE', 'Enter');

    return s;
  }

  private heldButton(name: string): boolean {
    return this.buttons.get(name)?.held ?? false;
  }

  endFrame(): void {
    clearEdges(this.state);
  }

  dispose(): void {
    for (const d of this.disposers) d();
    this.disposers = [];
    this.buttons.clear();
  }
}
