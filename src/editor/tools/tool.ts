// The contract between pointer input and a tool. Not here: which tool is active (the editor) or DOM events.
import type { Vec } from "../viewport.ts";

export interface PointerSample {
  readonly world: Vec;
  readonly screen: Vec;
  // In [0, 1]; meaningful only when `hasPressure` is true.
  readonly pressure: number;
  readonly hasPressure: boolean;
}

export interface Tool {
  readonly cursor: string;
  down(sample: PointerSample): void;
  move(sample: PointerSample): void;
  up(sample: PointerSample): void;
  cancel(): void;
}
