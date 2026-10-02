// Every item becomes a short list of path operations in item-local coordinates. The canvas renderer and the
// SVG export both draw from this list, so they cannot drift apart. Not here: the drawing itself.
import { strokePath } from "../geometry/freehand.ts";
import type { Color, Item } from "../model/item.ts";

export interface DrawOp {
  readonly d: string;
  readonly fill: Color | null;
  readonly stroke: Color | null;
  readonly width: number;
  // Hard offset shadow in ink, drawn underneath (ADR 0002).
  readonly shadow: boolean;
}

const cache = new WeakMap<Item, readonly DrawOp[]>();

function build(item: Item): readonly DrawOp[] {
  return [
    {
      d: strokePath(item.points, item.size, item.pressure),
      fill: item.color,
      stroke: null,
      width: 0,
      shadow: false,
    },
  ];
}

// Items are immutable, so the object itself is the cache key; an edit makes a new object and a fresh entry.
export function opsFor(item: Item): readonly DrawOp[] {
  let ops = cache.get(item);
  if (ops === undefined) {
    ops = build(item);
    cache.set(item, ops);
  }
  return ops;
}
