import { type Rect, clamp, damp, lerp } from '@/core/math';

export interface CameraTarget {
  x: number;
  y: number;
  /** Facing, for look-ahead. */
  facing: number;
  /** 0..1 how fast the target is moving, for look-ahead strength. */
  speed01: number;
}

export interface CameraFraming {
  zoom?: number;
  offsetX?: number;
  offsetY?: number;
  /** Hard-locks the horizontal position (scripted framing). */
  lockX?: number;
}

/**
 * Cinematic follow camera.
 *
 * Dead zones keep small movements from nudging the frame, look-ahead leads the
 * player in the direction they are walking, and every parameter is damped in
 * frame-rate independent time so the camera behaves the same at 30 and 60fps.
 *
 * The one hard rule: the camera never moves in a way the player did not cause.
 * Shake is short, bounded and always tied to an event.
 */
export class Camera {
  x = 0;
  y = 0;
  zoom = 1;

  /** Half-extent of the viewport in world units; set by the renderer. */
  viewHalfW = 480;
  viewHalfH = 270;

  private bounds: Rect = { x: -1e6, y: -1e6, w: 2e6, h: 2e6 };
  private lookAhead = 0;
  private shakeTime = 0;
  private shakeMagnitude = 0;
  private shakeSeed = 0;
  private framing: CameraFraming = {};
  private targetZoom = 1;
  private offsetX = 0;
  private offsetY = 0;

  readonly deadZoneX = 54;
  readonly deadZoneY = 46;

  setBounds(b: Rect): void {
    this.bounds = b;
  }

  setFraming(framing: CameraFraming | null): void {
    this.framing = framing ?? {};
    this.targetZoom = this.framing.zoom ?? 1;
  }

  /** Snaps to the target with no damping - scene entry, respawn, load. */
  snapTo(x: number, y: number): void {
    this.x = x;
    this.y = y - 30;
    this.lookAhead = 0;
    this.clampToBounds();
  }

  shake(magnitude: number, duration = 0.35): void {
    this.shakeMagnitude = Math.max(this.shakeMagnitude, magnitude);
    this.shakeTime = Math.max(this.shakeTime, duration);
    this.shakeSeed = Math.random() * 1000;
  }

  update(dt: number, target: CameraTarget): void {
    this.zoom = damp(this.zoom, this.targetZoom, 4, dt);
    this.offsetX = damp(this.offsetX, this.framing.offsetX ?? 0, 3.2, dt);
    this.offsetY = damp(this.offsetY, this.framing.offsetY ?? 0, 3.2, dt);

    // Look-ahead: lead the player, but only while they are actually moving.
    const desiredLook = target.facing * 86 * target.speed01;
    this.lookAhead = damp(this.lookAhead, desiredLook, 1.9, dt);

    const goalX = target.x + this.lookAhead + this.offsetX;
    const goalY = target.y - 34 + this.offsetY;

    if (this.framing.lockX !== undefined) {
      this.x = damp(this.x, this.framing.lockX, 3.4, dt);
    } else {
      // Dead zone: only chase once the goal leaves a small window.
      const dx = goalX - this.x;
      if (Math.abs(dx) > this.deadZoneX) {
        const excess = dx - Math.sign(dx) * this.deadZoneX;
        this.x = damp(this.x, this.x + excess, 5.5, dt);
      }
    }

    const dy = goalY - this.y;
    if (Math.abs(dy) > this.deadZoneY) {
      const excess = dy - Math.sign(dy) * this.deadZoneY;
      // Vertical is slower: a jumpy vertical camera is what makes players ill.
      this.y = damp(this.y, this.y + excess, 3.1, dt);
    }

    if (this.shakeTime > 0) {
      this.shakeTime -= dt;
      if (this.shakeTime <= 0) this.shakeMagnitude = 0;
      else this.shakeMagnitude = damp(this.shakeMagnitude, 0, 5, dt);
    }

    this.clampToBounds();
  }

  /** Current shake offset. Applied by the renderer, not stored in x/y. */
  shakeOffset(time: number): [number, number] {
    if (this.shakeTime <= 0) return [0, 0];
    const m = this.shakeMagnitude;
    const t = time * 34 + this.shakeSeed;
    return [Math.sin(t) * m + Math.sin(t * 2.7) * m * 0.4, Math.cos(t * 1.6) * m * 0.8];
  }

  private clampToBounds(): void {
    const hw = this.viewHalfW / this.zoom;
    const hh = this.viewHalfH / this.zoom;
    const b = this.bounds;
    // When the scene is narrower than the viewport, centre it rather than
    // letting the camera jam against one edge.
    if (b.w <= hw * 2) this.x = b.x + b.w * 0.5;
    else this.x = clamp(this.x, b.x + hw, b.x + b.w - hw);
    if (b.h <= hh * 2) this.y = b.y + b.h * 0.5;
    else this.y = clamp(this.y, b.y + hh, b.y + b.h - hh);
  }

  /** Blends toward a point, for scripted camera moves. */
  pushToward(x: number, y: number, t: number): void {
    this.x = lerp(this.x, x, t);
    this.y = lerp(this.y, y, t);
    this.clampToBounds();
  }
}
