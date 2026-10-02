// Draw operations for marks, laid onto the measured lines of their text. Cached per mark and target object,
// so a mark is rebuilt only when it or its text changes.
import { layOutMark } from "../annotate/layout.ts";
import { freehandPath } from "../geometry/freehand.ts";
import type { Box } from "../geometry/box.ts";
import { LINE_HEIGHT, PEN_WIDTH } from "../geometry/widths.ts";
import type { MarkItem, TextItem } from "../model/item.ts";
import { lineWidth } from "./measure.ts";
import type { PathOp } from "./ops.ts";

// Highlighter ink lets the text show through.
const BEHIND_OPACITY = 0.55;
const MARK_THINNING = 0.2;

const cache = new WeakMap<MarkItem, { readonly target: TextItem; readonly ops: readonly PathOp[] }>();

export function lineBoxes(text: TextItem): Box[] {
  const height = text.fontSize * LINE_HEIGHT;
  return text.text.split("\n").map((line, index) => ({
    x: text.x,
    y: text.y + index * height,
    width: lineWidth(line, text.fontSize),
    height,
  }));
}

// The freehand smoothing cuts corners off sparse strokes (a box turns into a lens), so long segments get
// intermediate points first. Step in world units.
function densify(points: readonly (readonly [number, number])[], step: number): [number, number][] {
  const out: [number, number][] = [];
  for (const [index, [x, y]] of points.entries()) {
    const previous = points[index - 1];
    if (previous !== undefined) {
      const count = Math.floor(Math.hypot(x - previous[0], y - previous[1]) / step);
      for (let i = 1; i < count; i++) {
        const t = i / count;
        out.push([previous[0] + (x - previous[0]) * t, previous[1] + (y - previous[1]) * t]);
      }
    }
    out.push([x, y]);
  }
  return out;
}

function build(mark: MarkItem, target: TextItem): PathOp[] {
  const step = target.fontSize * 0.15;
  return layOutMark(mark, lineBoxes(target)).map((stroke) => ({
    kind: "path",
    d: freehandPath(densify(stroke.points, step), {
      width: stroke.width ?? PEN_WIDTH[mark.size] * 0.8,
      pressure: false,
      thinning: MARK_THINNING,
    }),
    fill: mark.color,
    stroke: null,
    width: 0,
    shadow: false,
    opacity: mark.layer === "behind" ? BEHIND_OPACITY : 1,
  }));
}

export function markOps(mark: MarkItem, target: TextItem): readonly PathOp[] {
  const cached = cache.get(mark);
  if (cached?.target === target) return cached.ops;
  const ops = build(mark, target);
  cache.set(mark, { target, ops });
  return ops;
}
