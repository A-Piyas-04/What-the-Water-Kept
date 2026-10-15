import { Container } from 'pixi.js';
import { clamp, clamp01, damp, distance, moveToward, sign0 } from '@/core/math';
import { type StateDef, StateMachine } from '@/core/state-machine';
import {
  Character,
  DROWNED_BUILDS,
  DROWNED_COLORS,
  Disturbance,
  type PoseName,
} from '@/rendering/character';
import type { DrownedDef } from '@/world/types';
import { type Cone, coneRectIntensity } from './cone';

export type DrownedState =
  /** Standing where it has stood since 1964. Cannot see, cannot move. */
  | 'dormant'
  /** Lit just now. Turning. This is the window in which to douse the lamp. */
  | 'stirring'
  /** Walking to the last place it was lit. */
  | 'seeking'
  /** It has line of light on her. */
  | 'pursuing'
  /** Lost her. Standing still, listening. */
  | 'listening'
  /** Walking home. */
  | 'returning'
  /** Driven entirely by a script (Martin at the gate). */
  | 'scripted';

/** Tuning, shared by every Drowned. */
export interface DrownedTuning {
  /** Beam intensity needed to notice. */
  wakeThreshold: number;
  /** Seconds of being lit before it starts moving. */
  stirTime: number;
  /** Seconds it keeps looking after losing the light. */
  patience: number;
  /** Walk speed while seeking. */
  seekSpeed: number;
  /** Walk speed while pursuing. */
  pursueSpeed: number;
  /** Walk speed going home. */
  returnSpeed: number;
  /** How close it must get to take her. */
  reach: number;
  /** World units within which she feels the disturbance. */
  dreadRange: number;
}

export const DROWNED_TUNING: DrownedTuning = {
  wakeThreshold: 0.1,
  // Just under a second. Long enough to be a fair warning, short enough that
  // sweeping the beam carelessly across a room is genuinely a mistake.
  stirTime: 0.85,
  patience: 4.5,
  seekSpeed: 42,
  // Slower than Wren's run (182) and barely faster than her walk (96): it can
  // corner her, but it can never simply outrun her. Being caught is always a
  // consequence of a decision, not of the numbers.
  pursueSpeed: 104,
  returnSpeed: 34,
  reach: 16,
  dreadRange: 190,
};

export interface DrownedEvents {
  onNoticed?: (d: Drowned) => void;
  onLostHer?: (d: Drowned) => void;
  onTookHer?: (d: Drowned) => void;
  onStep?: (d: Drowned, nearness: number) => void;
}

interface Ctx {
  self: Drowned;
}

/**
 * One of the Drowned.
 *
 * The brief is explicit that enemies should obey understandable rules and that
 * complex AI needs a reason. There are exactly three rules here, and the
 * player can state all three after two encounters:
 *
 *   1. It cannot see you unless your light is on it.
 *   2. Once lit, it walks to where the light was.
 *   3. In darkness it stops. Standing still in the dark is always safe.
 *
 * Everything else - the patience timer, the return walk, the disturbance in
 * the silt - exists to make those three rules legible, not to add depth.
 */
export class Drowned {
  readonly id: string;
  readonly container = new Container();
  readonly character: Character;
  readonly disturbance = new Disturbance();

  x: number;
  y: number;
  facing = 1;
  vx = 0;

  /** Where it has always stood. */
  readonly homeX: number;
  readonly homeY: number;
  private readonly homeMin: number;
  private readonly homeMax: number;
  private readonly behaviour: DrownedDef['behaviour'];
  readonly variant: 'adult' | 'child' | 'keeper';

  /** Last world position at which it was lit. */
  private targetX = 0;
  /** Seconds since it last had light on it. */
  private sinceLit = 99;
  /** Accumulated lit time, for the stir delay. */
  private litFor = 0;
  /** Is the beam on it this step? */
  private lit = false;
  private litIntensity = 0;

  private readonly machine: StateMachine<DrownedState, Ctx>;
  private stepAccum = 0;
  private visualY = 0;
  private active = true;

  constructor(
    def: DrownedDef,
    private readonly tuning: DrownedTuning = DROWNED_TUNING,
    private readonly events: DrownedEvents = {},
  ) {
    this.id = def.id;
    this.x = def.x;
    this.y = def.y;
    this.homeX = def.x;
    this.homeY = def.y;
    this.homeMin = Math.min(def.homeMin, def.homeMax);
    this.homeMax = Math.max(def.homeMin, def.homeMax);
    this.behaviour = def.behaviour;
    this.variant = def.variant ?? 'adult';
    this.visualY = def.y;

    if (def.speed !== undefined) {
      this.tuning = { ...tuning, pursueSpeed: def.speed };
    }

    this.character = new Character(
      DROWNED_BUILDS[this.variant] ?? DROWNED_BUILDS.adult,
      DROWNED_COLORS,
      false,
    );
    // The Drowned move like people underwater: slowly, and a beat behind.
    this.character.blendRate = 5.5;
    this.container.addChild(this.character.container);

    const table: Record<DrownedState, StateDef<DrownedState, Ctx>> = {
      dormant: { to: ['stirring', 'scripted'] },
      stirring: { to: ['pursuing', 'dormant', 'returning', 'scripted'] },
      seeking: { to: ['pursuing', 'listening', 'returning', 'scripted'] },
      pursuing: { to: ['seeking', 'listening', 'returning', 'scripted'] },
      listening: { to: ['pursuing', 'seeking', 'returning', 'scripted'] },
      returning: { to: ['dormant', 'stirring', 'pursuing', 'scripted'] },
      scripted: { to: ['dormant'] },
    };
    this.machine = new StateMachine<DrownedState, Ctx>(table, 'dormant', { self: this });
  }

  get state(): DrownedState {
    return this.machine.state;
  }

  get awake(): boolean {
    return this.state !== 'dormant' && this.state !== 'scripted';
  }

  get isLit(): boolean {
    return this.lit;
  }

  setActive(active: boolean): void {
    this.active = active;
    this.container.visible = active;
    this.disturbance.container.visible = active;
  }

  get isActive(): boolean {
    return this.active;
  }

  /** Forces a state, for scripted sequences. */
  script(state: DrownedState): void {
    this.machine.force(state);
  }

  /** Hitbox used for cone tests and for reaching her. */
  get rect(): { x: number; y: number; w: number; h: number } {
    const build = DROWNED_BUILDS[this.variant] ?? DROWNED_BUILDS.adult;
    return { x: this.x - 8, y: this.y - build.height, w: 16, h: build.height };
  }

  /**
   * One simulation step.
   *
   * `cone` is the lantern (zero-length when dark); `px`/`py` is Wren.
   */
  update(dt: number, cone: Cone, px: number, py: number): void {
    if (!this.active) return;

    this.litIntensity = cone.length > 0 ? coneRectIntensity(cone, this.rect) : 0;
    this.lit = this.litIntensity >= this.tuning.wakeThreshold;
    if (this.lit) {
      this.sinceLit = 0;
      this.litFor += dt;
      this.targetX = px;
    } else {
      this.sinceLit += dt;
      this.litFor = Math.max(0, this.litFor - dt * 1.6);
    }

    this.machine.update(dt);
    this.think(dt, px, py);
    this.move(dt);
    this.updateDisturbance(dt, px, py);
  }

  private think(dt: number, px: number, py: number): void {
    const t = this.tuning;
    const reachable = Math.abs(this.y - py) < 70;

    switch (this.state) {
      case 'dormant':
        this.vx = 0;
        if (this.behaviour !== 'scripted' && this.litFor >= t.stirTime) {
          this.machine.go('stirring');
          this.events.onNoticed?.(this);
        }
        break;

      case 'stirring': {
        this.vx = 0;
        // It turns to face the light before it moves. This is the player's
        // window, and it is always the same length.
        this.facing = sign0(this.targetX - this.x) || this.facing;
        if (this.machine.timeInState > 0.75) {
          this.machine.go(this.lit ? 'pursuing' : 'seeking');
        } else if (!this.lit && this.sinceLit > 2.2) {
          // Doused immediately: it settles back without ever having moved.
          this.machine.go('dormant');
          this.litFor = 0;
        }
        break;
      }

      case 'pursuing': {
        this.facing = sign0(px - this.x) || this.facing;
        this.vx = this.facing * t.pursueSpeed;
        if (reachable && distance(this.x, this.y, px, py) <= t.reach) {
          this.events.onTookHer?.(this);
        }
        if (!this.lit) {
          this.machine.go('seeking');
          this.events.onLostHer?.(this);
        }
        break;
      }

      case 'seeking': {
        // Walks to the last place the light was, then listens.
        const dx = this.targetX - this.x;
        this.facing = sign0(dx) || this.facing;
        this.vx = Math.abs(dx) > 12 ? this.facing * t.seekSpeed : 0;
        if (this.lit) {
          this.machine.go('pursuing');
        } else if (Math.abs(dx) <= 12 || this.sinceLit > t.patience) {
          this.machine.go('listening');
        }
        break;
      }

      case 'listening': {
        this.vx = 0;
        if (this.lit) {
          this.machine.go('pursuing');
        } else if (this.machine.timeInState > t.patience) {
          this.machine.go('returning');
        }
        break;
      }

      case 'returning': {
        const dx = this.homeX - this.x;
        this.facing = sign0(dx) || this.facing;
        this.vx = Math.abs(dx) > 6 ? this.facing * t.returnSpeed : 0;
        if (this.lit && this.litFor >= this.tuning.stirTime * 0.5) {
          this.machine.go('pursuing');
        } else if (Math.abs(dx) <= 6) {
          this.x = this.homeX;
          this.vx = 0;
          this.litFor = 0;
          this.machine.go('dormant');
          // Face the way it has always faced.
          this.facing = this.behaviour === 'sentinel' ? 1 : this.facing;
        }
        break;
      }

      case 'scripted':
        this.vx = 0;
        break;
    }

    void dt;
  }

  private move(dt: number): void {
    // No gravity and no collision: the Drowned walk the 1964 floor, which is
    // flat along their patrol, and clamping to the patrol span is both cheaper
    // and more reliable than giving them a physics body.
    this.x = moveToward(this.x, this.x + this.vx * dt, Math.abs(this.vx) * dt + 0.001);
    this.x = clamp(this.x, this.homeMin, this.homeMax);
    if ((this.x <= this.homeMin && this.vx < 0) || (this.x >= this.homeMax && this.vx > 0)) {
      this.vx = 0;
    }

    this.stepAccum += Math.abs(this.vx) * dt;
    if (this.stepAccum > 40) {
      this.stepAccum = 0;
      this.events.onStep?.(this, clamp01(this.litIntensity));
    }
  }

  private updateDisturbance(dt: number, px: number, py: number): void {
    const d = distance(this.x, this.y, px, py);
    // Visible only when it is awake, close, and not already lit - the point is
    // to warn, not to replace the light.
    const near = 1 - clamp01(d / this.tuning.dreadRange);
    const strength = this.awake && !this.lit ? near * (Math.abs(this.y - py) < 90 ? 1 : 0.2) : 0;
    this.disturbance.setStrength(strength);
    this.disturbance.container.x = this.x;
    this.disturbance.container.y = this.y;
    this.disturbance.update(dt);
  }

  /** How much dread this one contributes, 0..1. */
  dreadContribution(px: number, py: number): number {
    if (!this.active) return 0;
    const d = distance(this.x, this.y, px, py);
    const near = 1 - clamp01(d / this.tuning.dreadRange);
    if (this.state === 'pursuing') return clamp01(0.55 + near * 0.45);
    if (this.state === 'stirring') return clamp01(0.3 + near * 0.4);
    if (this.awake) return near * 0.6;
    return near * 0.16;
  }

  /** Variable-step visual update. */
  render(dt: number): void {
    if (!this.active) return;
    let pose: PoseName;
    switch (this.state) {
      case 'dormant':
        pose = this.variant === 'child' ? 'idle' : 'idle';
        break;
      case 'stirring':
        pose = 'fear';
        break;
      case 'pursuing':
        pose = 'run';
        break;
      case 'seeking':
      case 'returning':
        pose = 'walk';
        break;
      case 'listening':
        pose = 'reach';
        break;
      default:
        pose = 'idle';
    }
    this.character.setPose(pose);
    const stride = pose === 'run' ? 40 : 34;
    this.character.strideRate = Math.abs(this.vx) / stride;
    this.visualY = damp(this.visualY, this.y, 14, dt);
    this.character.container.x = 0;
    this.character.container.y = 0;
    this.container.x = this.x;
    this.container.y = this.visualY;
    this.character.update(dt, this.facing);
  }

  /** Restores a position from a save; the Drowned always reset to dormant. */
  restore(): void {
    this.x = this.homeX;
    this.y = this.homeY;
    this.vx = 0;
    this.lit = false;
    this.litFor = 0;
    this.sinceLit = 99;
    this.machine.force('dormant');
    this.character.snapPose();
  }

  destroy(): void {
    this.character.destroy();
    this.disturbance.destroy();
    this.container.destroy({ children: true });
  }
}
