import { clamp01, damp } from '@/core/math';
import type { Cone } from '@/gameplay/cone';

/**
 * The Survey Lantern.
 *
 * Found in the silt at the foot of the dam, where the 1964 survey crew left
 * it. Its light does not illuminate the ruins: inside the beam, the valley is
 * as it was on the night of the flood.
 *
 * The rules, which the game never breaks:
 *   1. What the beam shows is really there - Before geometry is solid while lit.
 *   2. The Drowned exist only in the Before, and are blind in the dark.
 *   3. Lighting one is what lets it see you.
 *
 * So the lantern is simultaneously the only way forward and the only thing
 * that can get you killed, and every puzzle in the game is a negotiation
 * between those two facts.
 */
export class Lantern {
  /** Has the player found it yet? */
  found = false;
  /** Is the switch on? */
  on = false;
  /** 0..1 - the filament takes a moment to come up and to die. */
  intensity = 0;

  /** Beam reach in world units. */
  reach = 196;
  /** Half-angle, radians. */
  spread = 0.5;

  /** Where the beam starts, in world space. Set from the character's hand. */
  originX = 0;
  originY = 0;
  /** Beam axis, radians. */
  angle = 0;

  private targetAngle = 0;
  /** A brief surge when first switched on - and when something notices. */
  private surge = 0;
  /** Forced off by a script (the gate sequence drowns the lamp). */
  private suppressed = false;

  /** Maximum vertical tilt from the stick, radians. */
  readonly maxTilt = 0.72;

  toggle(): boolean {
    if (!this.found || this.suppressed) return false;
    this.on = !this.on;
    if (this.on) this.surge = 1;
    return true;
  }

  setOn(on: boolean): void {
    if (!this.found) return;
    if (on && this.suppressed) return;
    if (on && !this.on) this.surge = 1;
    this.on = on;
  }

  suppress(suppressed: boolean): void {
    this.suppressed = suppressed;
    if (suppressed) this.on = false;
  }

  get isSuppressed(): boolean {
    return this.suppressed;
  }

  /** Aims the beam: facing, plus vertical tilt from the stick. */
  aim(facing: number, tilt: number, dt: number): void {
    const base = facing >= 0 ? 0 : Math.PI;
    // Tilt is applied in the direction of facing, so pushing the stick up
    // always raises the beam regardless of which way she is looking.
    this.targetAngle = base + clamp01(Math.abs(tilt)) * Math.sign(tilt) * this.maxTilt * facing;
    // Damped aim gives the beam weight without making it feel laggy.
    this.angle = damp(this.angle, this.targetAngle, 13, dt);
    // Keep the angle near the target branch when facing flips.
    if (Math.abs(this.angle - this.targetAngle) > Math.PI) this.angle = this.targetAngle;
  }

  update(dt: number): void {
    const target = this.on ? 1 : 0;
    // Asymmetric ramp: comes up slowly like a real gas-discharge lamp, dies
    // fast. That asymmetry is a gameplay decision - dousing must be instant
    // enough to be a defensive action.
    const rate = this.on ? 5.2 : 15;
    this.intensity = damp(this.intensity, target, rate, dt);
    if (this.surge > 0) {
      this.surge = Math.max(0, this.surge - dt * 2.2);
      this.intensity = Math.min(1.25, this.intensity + this.surge * 0.3);
    }
  }

  /** Current cone. Zero-length when the lamp is effectively out. */
  get cone(): Cone {
    return {
      x: this.originX,
      y: this.originY,
      angle: this.angle,
      spread: this.spread,
      length: this.reach * Math.min(1, this.intensity),
    };
  }

  /** Is the beam doing anything at all? */
  get lit(): boolean {
    return this.found && this.on && this.intensity > 0.08;
  }

  reset(): void {
    this.on = false;
    this.intensity = 0;
    this.surge = 0;
    this.suppressed = false;
  }
}
