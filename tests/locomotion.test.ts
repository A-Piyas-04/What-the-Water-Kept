import { describe, expect, it } from 'vitest';
import {
  DEAD_INPUT,
  type LocomotionInput,
  WREN_TUNING,
  buildLocomotionMachine,
  canInterrupt,
  heightForState,
  isCrouched,
  resolveMoveState,
  speedForState,
} from '@/player/locomotion';

const input = (overrides: Partial<LocomotionInput> = {}): LocomotionInput => ({
  ...DEAD_INPUT,
  ...overrides,
});

describe('locomotion state resolution', () => {
  it('idles when there is no intent', () => {
    expect(resolveMoveState('idle', input())).toBe('idle');
  });

  it('walks on horizontal intent', () => {
    expect(resolveMoveState('idle', input({ moveX: 1 }))).toBe('walk');
  });

  it('ignores intent below the movement threshold', () => {
    expect(resolveMoveState('idle', input({ moveX: 0.05 }))).toBe('idle');
  });

  it('runs when asked', () => {
    expect(resolveMoveState('walk', input({ moveX: 1, wantsRun: true }))).toBe('run');
  });

  it('crouches in place and while moving', () => {
    expect(resolveMoveState('idle', input({ wantsCrouch: true }))).toBe('crouch');
    expect(resolveMoveState('crouch', input({ moveX: 1, wantsCrouch: true }))).toBe('crouchwalk');
  });

  it('forces a crouch inside a low space even without intent', () => {
    expect(resolveMoveState('run', input({ moveX: 1, wantsRun: true, inLowSpace: true }))).toBe(
      'crouchwalk',
    );
  });

  it('crouching beats running', () => {
    expect(
      resolveMoveState('run', input({ moveX: 1, wantsRun: true, wantsCrouch: true })),
    ).toBe('crouchwalk');
  });

  it('falls when not grounded', () => {
    expect(resolveMoveState('walk', input({ moveX: 1, onGround: false }))).toBe('fall');
  });

  it('climbs on a ladder with vertical intent, and stays on it', () => {
    expect(resolveMoveState('idle', input({ onLadder: true, wantsUp: true }))).toBe('climb');
    // Hanging still must not drop her off the ladder.
    expect(resolveMoveState('climb', input({ onLadder: true }))).toBe('climb');
  });

  it('does not climb a ladder she is merely standing next to', () => {
    expect(resolveMoveState('idle', input({ onLadder: true }))).toBe('idle');
  });

  it('priority order: stagger > locked > hiding > interacting', () => {
    expect(
      resolveMoveState('run', input({ staggered: true, locked: true, hiding: true, interacting: true })),
    ).toBe('stagger');
    expect(resolveMoveState('run', input({ locked: true, hiding: true, interacting: true }))).toBe(
      'scripted',
    );
    expect(resolveMoveState('run', input({ hiding: true, interacting: true }))).toBe('hide');
    expect(resolveMoveState('run', input({ interacting: true }))).toBe('interact');
  });

  it('scripted control overrides movement intent entirely', () => {
    expect(resolveMoveState('run', input({ moveX: 1, wantsRun: true, locked: true }))).toBe(
      'scripted',
    );
  });
});

describe('locomotion derived values', () => {
  it('orders the speeds sensibly', () => {
    const t = WREN_TUNING;
    expect(speedForState('run', t)).toBeGreaterThan(speedForState('walk', t));
    expect(speedForState('walk', t)).toBeGreaterThan(speedForState('crouchwalk', t));
    expect(speedForState('idle', t)).toBe(0);
    expect(speedForState('crouch', t)).toBe(0);
  });

  it('gives the player a shorter collider while crouched', () => {
    expect(heightForState('crouch', 56)).toBeLessThan(heightForState('idle', 56));
    expect(heightForState('crouchwalk', 56)).toBe(heightForState('crouch', 56));
    expect(heightForState('hide', 56)).toBe(heightForState('crouch', 56));
  });

  it('knows which states count as crouched', () => {
    expect(isCrouched('crouch')).toBe(true);
    expect(isCrouched('crouchwalk')).toBe(true);
    expect(isCrouched('hide')).toBe(true);
    expect(isCrouched('run')).toBe(false);
  });

  it('protects scripted and stagger states from interruption', () => {
    expect(canInterrupt('scripted')).toBe(false);
    expect(canInterrupt('stagger')).toBe(false);
    expect(canInterrupt('walk')).toBe(true);
  });

  it('decelerates faster than it accelerates, so control is not slippery', () => {
    expect(WREN_TUNING.decel).toBeGreaterThan(WREN_TUNING.accel);
    expect(WREN_TUNING.turnAccel).toBeGreaterThan(WREN_TUNING.decel);
  });
});

describe('locomotion transition table', () => {
  it('fires enter and exit hooks', () => {
    const log: string[] = [];
    const m = buildLocomotionMachine(
      {},
      {
        walk: { enter: () => log.push('enter:walk'), exit: () => log.push('exit:walk') },
        run: { enter: () => log.push('enter:run') },
      },
    );
    m.go('walk');
    m.go('run');
    expect(log).toEqual(['enter:walk', 'exit:walk', 'enter:run']);
  });

  it('refuses an illegal transition but allows a forced one', () => {
    const m = buildLocomotionMachine({});
    m.go('scripted');
    expect(m.state).toBe('scripted');
    // scripted may not go straight to run.
    expect(m.go('run')).toBe(false);
    expect(m.state).toBe('scripted');
    m.force('run');
    expect(m.state).toBe('run');
  });

  it('tracks time in state and the prior state', () => {
    const m = buildLocomotionMachine({});
    m.go('walk');
    m.update(0.25);
    expect(m.timeInState).toBeCloseTo(0.25, 5);
    m.go('run');
    expect(m.prior).toBe('walk');
    expect(m.timeInState).toBe(0);
  });
});
