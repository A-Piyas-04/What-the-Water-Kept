/**
 * Minimal explicit state machine. Used for player locomotion and for the
 * Drowned behaviour so that every transition is declared in one table and can
 * be unit-tested without a renderer.
 */
export interface StateDef<S extends string, Ctx> {
  /** States this state is allowed to move to. Empty array means "any". */
  readonly to: readonly S[];
  readonly enter?: (ctx: Ctx, from: S | null) => void;
  readonly exit?: (ctx: Ctx, to: S) => void;
  readonly update?: (ctx: Ctx, dt: number, timeInState: number) => void;
}

export class StateMachine<S extends string, Ctx> {
  private current: S;
  private elapsed = 0;
  private previous: S | null = null;

  constructor(
    private readonly table: Readonly<Record<S, StateDef<S, Ctx>>>,
    initial: S,
    private readonly ctx: Ctx,
  ) {
    this.current = initial;
    this.table[initial].enter?.(ctx, null);
  }

  get state(): S {
    return this.current;
  }

  get prior(): S | null {
    return this.previous;
  }

  get timeInState(): number {
    return this.elapsed;
  }

  canGo(to: S): boolean {
    if (to === this.current) return false;
    const allowed = this.table[this.current].to;
    return allowed.length === 0 || allowed.includes(to);
  }

  /** Returns true when the transition happened. */
  go(to: S): boolean {
    if (!this.canGo(to)) return false;
    this.force(to);
    return true;
  }

  /** Bypasses the transition table - for scripted cinematics and respawns. */
  force(to: S): void {
    if (to === this.current) return;
    const from = this.current;
    this.table[from].exit?.(this.ctx, to);
    this.previous = from;
    this.current = to;
    this.elapsed = 0;
    this.table[to].enter?.(this.ctx, from);
  }

  update(dt: number): void {
    this.elapsed += dt;
    this.table[this.current].update?.(this.ctx, dt, this.elapsed);
  }
}
