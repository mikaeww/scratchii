// The paint order of a scene: each item with its draw operations, and every mark directly behind or over its
// text. Shared by the canvas and the SVG export so both stack things the same way.
import type { Item, MarkItem } from "../model/item.ts";
import { markOps } from "./marks.ts";
import { opsFor, type DrawOp } from "./ops.ts";

export interface PaintStep {
  // Operations are in item-local coordinates; marks are already in world coordinates (origin 0, 0).
  readonly origin: readonly [number, number];
  readonly ops: readonly DrawOp[];
}

export function paintOrder(items: readonly Item[]): PaintStep[] {
  const marks = new Map<string, MarkItem[]>();
  for (const item of items) {
    if (item.type === "mark" && !item.deleted)
      marks.set(item.target, [...(marks.get(item.target) ?? []), item]);
  }
  const steps: PaintStep[] = [];
  for (const item of items) {
    if (item.deleted || item.type === "mark") continue;
    const own = item.type === "text" ? (marks.get(item.id) ?? []) : [];
    const layer = (which: MarkItem["layer"]): PaintStep[] =>
      item.type !== "text"
        ? []
        : own.filter((m) => m.layer === which).map((m) => ({ origin: [0, 0], ops: markOps(m, item) }));
    steps.push(...layer("behind"), { origin: [item.x, item.y], ops: opsFor(item) }, ...layer("over"));
  }
  return steps;
}
