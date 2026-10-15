import { clamp, clamp01, damp, moveToward, sign0 } from '@/core/math';
import { CollisionWorld, type SolidityQuery, moveBody, settleOnGround } from '@/physics/collision';
import { type Body, bodyRect, makeBody } from '@/physics/types';
import { Character, WREN_BUILD, WREN_COLORS, type PoseName } from '@/rendering/character';
import type { Facing } from '@/world/types';
import { Lantern } from './lantern';
import {
  type LocomotionInput,
  type MoveState,
  WREN_TUNING,
  heightForState,
  isCrouched,
  resolveMoveState,
  speedForState,
} from './locomotion';

export interface PlayerFrameInput {
  moveX: number;
  moveY: number;
  magnitude: number;
  run: boolean;
  crouch: boolean;
  up: boolean;
  down: boolean;
}

export interface PlayerEvents {
  onFootstep?: (state: MoveState, speed01: number) => void;
  onLanded?: (impactSpeed: number) => void;
  onStateChange?: (from: MoveState, to: MoveState) => void;
}

const STANDING_HEIGHT = 56;

/**
 * Wren Calloway, hydrographic surveyor.
 *
 * Simulation and presentation are kept apart: this class owns a physics body
 * and a state machine, and only pushes a pose name and a position into the
 * `Character` rig. Nothing here touches PixiJS beyond handing the rig a
 * transform.
 */
export class Player {
  readonly body: Body = makeBody(0, 0, 9, STANDING_HEIGHT);
  readonly lantern = new Lantern();
  readonly character = new Character(WREN_BUILD, WREN_COLORS, true);

  state: MoveState = 'idle';
  facing: Facing = 1;

  /** Set by the gameplay layer while a scripted sequence owns the body. */
  locked = false;
  hiding = false;
  interacting = false;
  staggered = false;

  /** 0..1, drives the fear pose and the breathing audio. */
  dread = 0;

  private interactTimer = 0;
  private staggerTimer = 0;
  private footAccum = 0;
  private lastGroundY = 0;
  private coyote = 0;
  private visualY = 0;

  constructor(private readonly events: PlayerEvents = {}) {}

  get x(): number {
    return this.body.x;
  }

  get y(): number {
    return this.body.y;
  }

  /** Horizontal speed as a fraction of running. */
  get speed01(): number {
    return clamp01(Math.abs(this.body.vx) / WREN_TUNING.runSpeed);
  }

  get crouched(): boolean {
    return isCrouched(this.state);
  }

  /** Centre of the torso - what the camera and the Drowned aim at. */
  get centerY(): number {
    return this.body.y - this.body.height * 0.55;
  }

  placeAt(x: number, y: number, facing: Facing, world?: CollisionWorld, q?: SolidityQuery): void {
    this.body.x = x;
    this.body.y = y;
    this.body.vx = 0;
    this.body.vy = 0;
    this.facing = facing;
    this.state = 'idle';
    this.interactTimer = 0;
    this.staggerTimer = 0;
    this.hiding = false;
    this.interacting = false;
    this.staggered = false;
    this.locked = false;
    this.visualY = y;
    this.lastGroundY = y;
    if (world && q) settleOnGround(this.body, world, q, 400);
    this.body.height = STANDING_HEIGHT;
    this.character.setPose('idle');
    this.character.snapPose();
    this.syncLampOrigin();
  }

  /** Plays a one-shot interaction animation. */
  playInteract(duration = WREN_TUNING.interactTime, pose: 'interact' | 'reach' | 'kneel' = 'interact'): void {
    this.interacting = true;
    this.interactTimer = duration;
    this.interactPose = pose;
  }

  private interactPose: 'interact' | 'reach' | 'kneel' = 'interact';

  /** Knocks her back - the Drowned's touch, a collapsing floor. */
  stagger(fromX: number, strength = 1): void {
    this.staggered = true;
    this.staggerTimer = 0.55;
    this.body.vx = sign0(this.body.x - fromX) * 150 * strength;
    this.body.vy = -110 * strength;
  }

  /** The fixed-step simulation. */
  update(
    dt: number,
    input: PlayerFrameInput,
    world: CollisionWorld,
    q: SolidityQuery,
  ): void {
    const tuning = WREN_TUNING;

    if (this.interactTimer > 0) {
      this.interactTimer -= dt;
      if (this.interactTimer <= 0) this.interacting = false;
    }
    if (this.staggerTimer > 0) {
      this.staggerTimer -= dt;
      if (this.staggerTimer <= 0) this.staggered = false;
    }

    // Probe whether standing up is currently possible: if a ceiling is in the
    // way she stays crouched rather than clipping through it.
    const crouchedNow = isCrouched(this.state);
    let blockedAbove = false;
    if (crouchedNow) {
      const standRect = {
        x: this.body.x - this.body.halfWidth,
        y: this.body.y - STANDING_HEIGHT,
        w: this.body.halfWidth * 2,
        h: STANDING_HEIGHT,
      };
      blockedAbove = world.blocked(standRect, q);
    }

    const locoInput: LocomotionInput = {
      moveX: input.moveX,
      wantsRun: input.run,
      wantsCrouch: input.crouch || blockedAbove,
      wantsUp: input.up,
      wantsDown: input.down,
      onGround: this.body.onGround || this.coyote > 0,
      onLadder: this.body.onLadder,
      inLowSpace: this.body.inLowSpace || blockedAbove,
      locked: this.locked,
      hiding: this.hiding,
      interacting: this.interacting,
      staggered: this.staggered,
    };

    const next = resolveMoveState(this.state, locoInput);
    if (next !== this.state) {
      this.events.onStateChange?.(this.state, next);
      this.state = next;
    }

    // Collider height follows the state, and the feet stay planted when it
    // changes so crouching never pops her through the floor.
    this.body.height = heightForState(this.state, STANDING_HEIGHT);

    // --- Horizontal ---
    if (this.state === 'scripted' || this.state === 'hide') {
      this.body.vx = moveToward(this.body.vx, 0, tuning.decel * dt);
    } else if (this.state === 'stagger') {
      this.body.vx = moveToward(this.body.vx, 0, tuning.decel * 0.55 * dt);
    } else if (this.state === 'climb') {
      this.body.vx = moveToward(this.body.vx, input.moveX * tuning.crouchSpeed * 0.6, tuning.accel * dt);
    } else {
      const target = input.moveX * speedForState(this.state, tuning);
      let rate: number;
      if (Math.abs(input.moveX) < 0.12) rate = tuning.decel;
      else if (sign0(input.moveX) !== sign0(this.body.vx) && this.body.vx !== 0) rate = tuning.turnAccel;
      else rate = tuning.accel;
      this.body.vx = moveToward(this.body.vx, target, rate * dt);
    }

    // --- Vertical ---
    if (this.state === 'climb') {
      const dir = (input.up ? -1 : 0) + (input.down ? 1 : 0);
      this.body.vy = dir * tuning.climbSpeed;
      // Stepping off the top of a ladder onto solid ground.
      if (dir < 0 && !this.body.onLadder) this.body.vy = -tuning.climbSpeed * 0.5;
    } else {
      this.body.vy = Math.min(tuning.maxFall, this.body.vy + tuning.gravity * dt);
    }

    const before = this.body.vy;
    const result = moveBody(this.body, dt, world, q);

    if (this.body.onGround) {
      this.coyote = 0.09;
      this.lastGroundY = this.body.y;
    } else {
      this.coyote = Math.max(0, this.coyote - dt);
    }

    if (result.landed) this.events.onLanded?.(before);

    // --- Facing ---
    if (Math.abs(input.moveX) > 0.2 && this.state !== 'scripted' && this.state !== 'hide') {
      this.facing = input.moveX > 0 ? 1 : -1;
    }

    // --- Footsteps, driven by distance travelled, not by a timer ---
    if (
      this.body.onGround &&
      (this.state === 'walk' || this.state === 'run' || this.state === 'crouchwalk')
    ) {
      const stride = this.state === 'run' ? 46 : this.state === 'crouchwalk' ? 34 : 38;
      this.footAccum += Math.abs(this.body.vx) * dt;
      if (this.footAccum >= stride) {
        this.footAccum -= stride;
        this.events.onFootstep?.(this.state, this.speed01);
      }
    } else {
      this.footAccum = Math.min(this.footAccum, 20);
    }

    // --- Lantern ---
    const tilt = -input.moveY;
    this.lantern.aim(this.facing, this.state === 'climb' ? 0 : tilt, dt);
    this.lantern.update(dt);
    this.syncLampOrigin();
  }

  /** Puts the beam origin at the lantern in her hand. */
  private syncLampOrigin(): void {
    const [lx, ly] = this.character.lampOffset();
    this.lantern.originX = this.body.x + lx * this.facing;
    this.lantern.originY = this.body.y + ly;
  }

  /** Variable-step visual update. */
  render(dt: number): void {
    const pose = this.posePose();
    this.character.setPose(pose);

    // Stride rate scales with actual speed so the feet never skate.
    if (pose === 'walk' || pose === 'run' || pose === 'crouchwalk') {
      const stride = pose === 'run' ? 46 : pose === 'crouchwalk' ? 34 : 38;
      this.character.strideRate = Math.abs(this.body.vx) / stride;
    } else if (pose === 'climb') {
      this.character.strideRate = Math.abs(this.body.vy) / 26;
    } else {
      this.character.strideRate = 0;
    }

    // Smooth the drawn Y a little so stepping over small ledges does not
    // judder, while never lagging far enough to look detached.
    this.visualY = damp(this.visualY, this.body.y, 26, dt);
    if (Math.abs(this.visualY - this.body.y) > 14) this.visualY = this.body.y;

    this.character.container.x = this.body.x;
    this.character.container.y = this.visualY;
    this.character.update(dt, this.facing);
    this.syncLampOrigin();
  }

  private posePose(): PoseName {
    switch (this.state) {
      case 'idle':
        // High dread shows in the body before it shows in the face.
        return this.dread > 0.62 ? 'fear' : 'idle';
      case 'walk':
        return 'walk';
      case 'run':
        return 'run';
      case 'crouch':
        return 'crouch';
      case 'crouchwalk':
        return 'crouchwalk';
      case 'climb':
        return 'climb';
      case 'fall':
        return 'fall';
      case 'interact':
        return this.interactPose;
      case 'hide':
        return 'crouch';
      case 'stagger':
        return 'stagger';
      case 'scripted':
        return this.scriptedPose;
    }
  }

  /** Scripted sequences set the pose directly. */
  scriptedPose: PoseName = 'idle';

  setDread(value: number): void {
    this.dread = clamp01(value);
  }

  /** Hitbox, for the Drowned and for trigger volumes. */
  get rect(): { x: number; y: number; w: number; h: number } {
    return bodyRect(this.body);
  }

  get fellFrom(): number {
    return clamp(this.body.y - this.lastGroundY, 0, 2000);
  }

  destroy(): void {
    this.character.destroy();
  }
}
