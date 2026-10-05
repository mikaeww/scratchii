// Every item becomes a short list of draw operations in item-local coordinates. The canvas renderer and the
// SVG export both draw from this list, so they cannot drift apart. Not here: the drawing itself.
import { markerPath, strokePath } from "../geometry/freehand.ts";
import { boxOutline, lineOutline } from "../geometry/outline.ts";
import { LINE_HEIGHT, NOTE_FONT_SIZE, NOTE_PADDING, SHAPE_WIDTH } from "../geometry/widths.ts";
import type { Color, Item, NoteItem } from "../model/item.ts";
import { chartOps, graphOps } from "./items/charts.ts";
import { lineLabelOps, shapeLabelOps } from "./items/labels.ts";
import { tableOps } from "./items/tables.ts";
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
  // Where x sits on each line: its left end, its middle or its right end.
  readonly align: "start" | "middle" | "end";
}

export interface ImageOp {
  readonly kind: "image";
  readonly src: string;
  readonly width: number;
  readonly height: number;
}

export type DrawOp = PathOp | TextOp | ImageOp;

const cache = new WeakMap<Item, readonly DrawOp[]>();
// Highlighter ink lets what is underneath show through; marks behind text use the same value.
export const MARKER_OPACITY = 0.55;

// Only notes cast the hard shadow (ADR 0005): on a drawn ellipse it reads as a thicker outline.
function outlineOp(d: string, fill: Color | null, stroke: Color, item: Item): PathOp {
  return {
    kind: "path",
    d,
    fill,
    stroke,
    width: SHAPE_WIDTH[item.size],
    shadow: item.type === "note",
    opacity: 1,
  };
}

function noteOps(item: NoteItem): DrawOp[] {
  const fontSize = NOTE_FONT_SIZE[item.size];
  const lines = wrapText(item.text, fontSize, item.width - 2 * NOTE_PADDING);
  return [
    outlineOp(boxOutline(item), item.fill, "ink", item),
    {
      kind: "text",
      lines,
      x: NOTE_PADDING,
      y: NOTE_PADDING,
      fontSize,
      lineHeight: fontSize * LINE_HEIGHT,
      color: item.color,
      align: "start",
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
    case "ellipse":
    case "polygon":
      return [outlineOp(boxOutline(item), item.fill, item.color, item), ...shapeLabelOps(item)];
    case "line":
    case "arrow":
      return [outlineOp(lineOutline(item), null, item.color, item), ...lineLabelOps(item)];
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
          align: "start",
        },
      ];
    }
    case "note":
      return noteOps(item);
    case "image":
      return [{ kind: "image", src: item.src, width: item.width, height: item.height }];
    case "graph":
      return graphOps(item);
    case "chart":
      return chartOps(item);
    case "table":
      return tableOps(item);
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
