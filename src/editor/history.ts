// Undo and redo over immutable snapshots; old snapshots share unchanged items, so memory grows with edits only.
// Not here: what a snapshot contains or when to take one.

export class History<T> {
  private states: T[];
  private index = 0;
  private readonly limit: number;

  constructor(initial: T, limit = 200) {
    this.states = [initial];
    this.limit = limit;
  }

  get current(): T {
    const state = this.states[this.index];
    if (state === undefined) throw new Error("invariant: index points into states");
    return state;
  }

  get canUndo(): boolean {
    return this.index > 0;
  }

  get canRedo(): boolean {
    return this.index < this.states.length - 1;
  }

  commit(state: T): void {
    this.states = this.states.slice(0, this.index + 1);
    this.states.push(state);
    if (this.states.length > this.limit) this.states.shift();
    this.index = this.states.length - 1;
  }

  undo(): T {
    if (this.canUndo) this.index--;
    return this.current;
  }

  redo(): T {
    if (this.canRedo) this.index++;
    return this.current;
  }

  // Replaces the whole history, e.g. after opening another board.
  reset(state: T): void {
    this.states = [state];
    this.index = 0;
  }
}
