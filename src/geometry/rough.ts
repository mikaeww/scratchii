// Hand-drawn outlines and fills for shapes, notes, lines and arrows, as SVG path data (roughjs).
// One bold, slightly wobbly stroke instead of roughjs' double sketch line: a marker, not a pencil (ADR 0002).
import rough from "roughjs";
import type { LineItem, NoteItem, ShapeItem } from "../model/item.ts";
import { SHAPE_WIDTH } from "./widths.ts";

export interface RoughPaths {
  readonly fill: string | null;
  readonly outline: readonly string[];
}

const generator = rough.generator();
const ARROW_ANGLE = Math.PI / 6.5;

type Drawable = ReturnType<typeof generator.line>;

function options(
  item: ShapeItem | NoteItem | LineItem,
  filled: boolean,
): Parameters<typeof generator.line>[4] {
  return {
    // roughjs treats seed 0 as "random", which would make the wobble change on every render.
    seed: item.seed + 1,
    roughness: 1.15,
    bowing: 0.9,
    strokeWidth: SHAPE_WIDTH[item.size],
    disableMultiStroke: true,
    preserveVertices: true,
    ...(filled ? { fill: "fill", fillStyle: "solid" } : {}),
  };
}

function split(drawables: readonly Drawable[]): RoughPaths {
  let fill: string | null = null;
  const outline: string[] = [];
  for (const path of drawables.flatMap((d) => generator.toPaths(d))) {
    if (path.fill !== undefined && path.fill !== "none") fill = path.d;
    else outline.push(path.d);
  }
  return { fill, outline };
}

export function roughBox(item: ShapeItem | NoteItem): RoughPaths {
  const filled = item.fill !== null;
  const { width, height } = item;
  if (item.type === "ellipse")
    return split([generator.ellipse(width / 2, height / 2, width, height, options(item, filled))]);
  return split([generator.rectangle(0, 0, width, height, options(item, filled))]);
}

export function roughLine(item: LineItem): RoughPaths {
  const [[ax, ay], [bx, by]] = item.points;
  const drawables = [generator.line(ax, ay, bx, by, options(item, false))];
  if (item.type === "arrow") {
    const angle = Math.atan2(by - ay, bx - ax);
    const head = Math.min(Math.hypot(bx - ax, by - ay) / 2, 10 + SHAPE_WIDTH[item.size] * 4);
    for (const side of [-1, 1]) {
      const wing = angle + Math.PI + side * ARROW_ANGLE;
      const wingItem = { ...item, seed: item.seed + side + 2 };
      drawables.push(
        generator.line(
          bx,
          by,
          bx + Math.cos(wing) * head,
          by + Math.sin(wing) * head,
          options(wingItem, false),
        ),
      );
    }
  }
  return split(drawables);
}
