// Every item becomes a short list of draw operations in item-local coordinates. The canvas renderer and the
// SVG export both draw from this list, so they cannot drift apart. Not here: the drawing itself.
import { markerPath, strokePath } from "../geometry/freehand.ts";
import { roughBox, roughLine, type RoughPaths } from "../geometry/rough.ts";
import { LINE_HEIGHT, NOTE_FONT_SIZE, NOTE_PADDING, SHAPE_WIDTH } from "../geometry/widths.ts";
import type { Color, Item, NoteItem } from "../model/item.ts";
import { wrapText } from "./measure.ts";

export interface PathOp {
  readonly kind: "path";
  readonly d: string;
  readonly fill: Color | null;
  readonly stroke: Color | null;
  readonly width: number;
  // Hard offset shadow in ink, drawn underneath (ADR 0002).
  readonly shadow: boolean;
  readonly opacity: number;
}

export interface TextOp {
  readonly kind: "text";
  readonly lines: readonly string[];
  readonly x: number;
  readonly y: number;
  readonly fontSize: number;
  readonly lineHeight: number;
  readonly color: Color;
}

export type DrawOp = PathOp | TextOp;

const cache = new WeakMap<Item, readonly DrawOp[]>();
// Highlighter ink lets what is underneath show through; marks behind text use the same value.
export const MARKER_OPACITY = 0.55;

function fillOp(d: string, fill: Color): PathOp {
  return { kind: "path", d, fill, stroke: null, width: 0, shadow: true, opacity: 1 };
}

function outlineOps(paths: RoughPaths, color: Color, width: number): PathOp[] {
  return paths.outline.map((d) => ({
    kind: "path",
    d,
    fill: null,
    stroke: color,
    width,
    shadow: false,
    opacity: 1,
  }));
}

function noteOps(item: NoteItem): DrawOp[] {
  const paths = roughBox(item);
  const fontSize = NOTE_FONT_SIZE[item.size];
  const lines = wrapText(item.text, fontSize, item.width - 2 * NOTE_PADDING);
  return [
    ...(paths.fill === null ? [] : [fillOp(paths.fill, item.fill)]),
    ...outlineOps(paths, "ink", SHAPE_WIDTH[item.size]),
    {
      kind: "text",
      lines,
      x: NOTE_PADDING,
      y: NOTE_PADDING,
      fontSize,
      lineHeight: fontSize * LINE_HEIGHT,
      color: item.color,
    },
  ];
}

function build(item: Item): readonly DrawOp[] {
  switch (item.type) {
    case "stroke": {
      const marker = item.tip === "marker";
      const d = marker
        ? markerPath(item.points, item.size)
        : strokePath(item.points, item.size, item.pressure);
      return [
        {
          kind: "path",
          d,
          fill: item.color,
          stroke: null,
          width: 0,
          shadow: false,
          opacity: marker ? MARKER_OPACITY : 1,
        },
      ];
    }
    case "rect":
    case "ellipse": {
      const paths = roughBox(item);
      const fill = paths.fill === null || item.fill === null ? [] : [fillOp(paths.fill, item.fill)];
      return [...fill, ...outlineOps(paths, item.color, SHAPE_WIDTH[item.size])];
    }
    case "line":
    case "arrow":
      return outlineOps(roughLine(item), item.color, SHAPE_WIDTH[item.size]);
    case "text": {
      const lineHeight = item.fontSize * LINE_HEIGHT;
      return [
        {
          kind: "text",
          lines: item.text.split("\n"),
          x: 0,
          y: 0,
          fontSize: item.fontSize,
          lineHeight,
          color: item.color,
        },
      ];
    }
    case "note":
      return noteOps(item);
    // Marks depend on their target and are drawn by render/marks.ts.
    case "mark":
      return [];
  }
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
