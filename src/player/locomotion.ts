import { type StateDef, StateMachine } from '@/core/state-machine';

export type MoveState =
  | 'idle'
  | 'walk'
  | 'run'
  | 'crouch'
  | 'crouchwalk'
  | 'climb'
  | 'fall'
  | 'interact'
  | 'hide'
  | 'scripted'
  | 'stagger';

/** What the state machine is allowed to read. Kept tiny so it is testable. */
export interface LocomotionInput {
  /** Horizontal intent, -1..1. */
  moveX: number;
  wantsRun: boolean;
  wantsCrouch: boolean;
  wantsUp: boolean;
  wantsDown: boolean;
  onGround: boolean;
  onLadder: boolean;
  /** Forced crouch: the player is inside a low space. */
  inLowSpace: boolean;
  /** A scripted sequence or interaction owns the body. */
  locked: boolean;
  hiding: boolean;
  interacting: boolean;
  staggered: boolean;
}

export const DEAD_INPUT: LocomotionInput = {
  moveX: 0,
  wantsRun: false,
  wantsCrouch: false,
  wantsUp: false,
  wantsDown: false,
  onGround: true,
  onLadder: false,
  inLowSpace: false,
  locked: false,
  hiding: false,
  interacting: false,
  staggered: false,
};

const MOVING = 0.12;

/**
 * Chooses the locomotion state from one frame of intent.
 *
 * Deliberately a pure function: the whole movement state graph can be
 * exercised in unit tests with no renderer, no physics and no PixiJS, which is
 * what PART 13 of the brief asks for.
 */
export const resolveMoveState = (
  current: MoveState,
  input: LocomotionInput,
): MoveState => {
  if (input.staggered) return 'stagger';
  if (input.locked) return 'scripted';
  if (input.hiding) return 'hide';
  if (input.interacting) return 'interact';

  // On a ladder, vertical intent takes over entirely.
  if (input.onLadder && (input.wantsUp || input.wantsDown || current === 'climb')) {
    if (input.wantsUp || input.wantsDown) return 'climb';
    // Hanging still on the ladder stays in climb rather than falling off.
    return 'climb';
  }

  if (!input.onGround) return 'fall';

  const moving = Math.abs(input.moveX) > MOVING;
  const crouching = input.wantsCrouch || input.inLowSpace;

  if (crouching) return moving ? 'crouchwalk' : 'crouch';
  if (!moving) return 'idle';
  return input.wantsRun ? 'run' : 'walk';
};

/** Movement tuning. One place to adjust how the game feels. */
export interface MoveTuning {
  walkSpeed: number;
  runSpeed: number;
  crouchSpeed: number;
  climbSpeed: number;
  /** Acceleration toward target speed, px/s^2. */
  accel: number;
  /** Deceleration when intent stops, px/s^2. */
  decel: number;
  /** Extra deceleration when reversing direction, so turns feel crisp. */
  turnAccel: number;
  gravity: number;
  maxFall: number;
  /** Seconds to hold an interaction pose. */
  interactTime: number;
}

export const WREN_TUNING: MoveTuning = {
  walkSpeed: 96,
  runSpeed: 182,
  crouchSpeed: 56,
  climbSpeed: 72,
  // High accel with high decel: responsive, never slippery. The brief is
  // explicit that controls must not feel like ice.
  accel: 980,
  decel: 1500,
  turnAccel: 2200,
  gravity: 1180,
  maxFall: 760,
  interactTime: 0.42,
};

export const speedForState = (state: MoveState, tuning: MoveTuning): number => {
  switch (state) {
    case 'run':
      return tuning.runSpeed;
    case 'walk':
      return tuning.walkSpeed;
    case 'crouchwalk':
      return tuning.crouchSpeed;
    case 'fall':
      return tuning.runSpeed * 0.82;
    default:
      return 0;
  }
};

/** Collider height per state - crouching must actually fit under things. */
export const heightForState = (state: MoveState, standing: number): number => {
  switch (state) {
    case 'crouch':
    case 'crouchwalk':
    case 'hide':
      return standing * 0.56;
    case 'stagger':
      return standing * 0.8;
    default:
      return standing;
  }
};

export const isCrouched = (state: MoveState): boolean =>
  state === 'crouch' || state === 'crouchwalk' || state === 'hide';

export const canInterrupt = (state: MoveState): boolean =>
  state !== 'scripted' && state !== 'stagger';

/**
 * A declarative transition table alongside the pure resolver.
 *
 * `resolveMoveState` decides what the player wants; this table is what the
 * animation layer subscribes to, and it is where "you cannot go straight from
 * scripted to run" style rules live.
 */
export const buildLocomotionMachine = <Ctx>(
  ctx: Ctx,
  hooks: Partial<Record<MoveState, Omit<StateDef<MoveState, Ctx>, 'to'>>> = {},
): StateMachine<MoveState, Ctx> => {
  const all: MoveState[] = [];
  const def = (to: readonly MoveState[], name: MoveState): StateDef<MoveState, Ctx> => ({
    to,
    ...(hooks[name] ?? {}),
  });
  const table: Record<MoveState, StateDef<MoveState, Ctx>> = {
    idle: def(all, 'idle'),
    walk: def(all, 'walk'),
    run: def(all, 'run'),
    crouch: def(all, 'crouch'),
    crouchwalk: def(all, 'crouchwalk'),
    climb: def(all, 'climb'),
    fall: def(all, 'fall'),
    interact: def(['idle', 'walk', 'crouch', 'fall', 'scripted', 'stagger', 'hide'], 'interact'),
    hide: def(['idle', 'crouch', 'scripted', 'stagger'], 'hide'),
    // A scripted sequence releases the body only back to a grounded state.
    scripted: def(['idle', 'crouch', 'fall', 'stagger'], 'scripted'),
    stagger: def(['idle', 'fall', 'scripted'], 'stagger'),
  };
  return new StateMachine<MoveState, Ctx>(table, 'idle', ctx);
};
