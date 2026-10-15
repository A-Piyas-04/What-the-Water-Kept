/** One frame of player intent, however it was produced. */
export interface InputState {
  /** -1..1 horizontal. */
  moveX: number;
  /** -1..1 vertical (positive = down). */
  moveY: number;
  /** Stick magnitude 0..1; past the run threshold the player runs. */
  magnitude: number;
  run: boolean;
  crouch: boolean;
  /** Held, for ladders and the hold-to-hide action. */
  up: boolean;
  down: boolean;
  /** Edge-triggered; consumed by the gameplay layer. */
  lanternPressed: boolean;
  interactPressed: boolean;
  pausePressed: boolean;
  journalPressed: boolean;
  /** Held, for actions that need a hold (hiding, turning a dial). */
  interactHeld: boolean;
  /** True while any pointer is down on the movement side. */
  touching: boolean;
}

export const makeInputState = (): InputState => ({
  moveX: 0,
  moveY: 0,
  magnitude: 0,
  run: false,
  crouch: false,
  up: false,
  down: false,
  lanternPressed: false,
  interactPressed: false,
  pausePressed: false,
  journalPressed: false,
  interactHeld: false,
  touching: false,
});

/** Clears the edge-triggered fields. Called at the end of each frame. */
export const clearEdges = (s: InputState): void => {
  s.lanternPressed = false;
  s.interactPressed = false;
  s.pausePressed = false;
  s.journalPressed = false;
};

export const RUN_THRESHOLD = 0.72;
export const CROUCH_THRESHOLD = 0.55;
