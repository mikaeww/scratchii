// The eight built-in marks, drawn as normalised strokes (see MarkItem in src/model/item.ts).
// v: 0 is the top of the line box, 1 the bottom; the glyph baseline sits near 0.62, descenders end near 0.78.
import type { Color, MarkItem, MarkStroke } from "../model/item.ts";

export type PresetShape = Pick<MarkItem, "layer" | "fit" | "strokes">;

export interface Preset extends PresetShape {
  readonly id: string;
}

type Points = (readonly [number, number])[];

function stroke(points: Points, weight: number | null = null): MarkStroke {
  return { points, weight };
}

function sample(count: number, at: (t: number) => readonly [number, number]): Points {
  return Array.from({ length: count + 1 }, (_, i) => at(i / count));
}

const UNDER = 0.88;

export const PRESETS: readonly Preset[] = [
  {
    id: "line",
    layer: "over",
    fit: "stretch",
    strokes: [
      stroke([
        [-0.02, UNDER + 0.01],
        [0.35, UNDER - 0.01],
        [0.7, UNDER + 0.01],
        [1.02, UNDER - 0.005],
      ]),
    ],
  },
  {
    id: "double",
    layer: "over",
    fit: "stretch",
    strokes: [
      stroke(
        [
          [-0.02, UNDER - 0.07],
          [0.5, UNDER - 0.08],
          [1.02, UNDER - 0.06],
        ],
        0.07,
      ),
      stroke(
        [
          [0.01, UNDER + 0.1],
          [0.5, UNDER + 0.09],
          [0.99, UNDER + 0.11],
        ],
        0.07,
      ),
    ],
  },
  {
    id: "wave",
    layer: "over",
    fit: "repeat",
    strokes: [stroke(sample(12, (t) => [t, UNDER + 0.05 * Math.sin(t * Math.PI * 2)]))],
  },
  {
    id: "zigzag",
    layer: "over",
    fit: "repeat",
    strokes: [
      stroke([
        [0, UNDER + 0.05],
        [0.25, UNDER - 0.05],
        [0.5, UNDER + 0.05],
        [0.75, UNDER - 0.05],
        [1, UNDER + 0.05],
      ]),
    ],
  },
  {
    id: "marker",
    layer: "behind",
    fit: "stretch",
    strokes: [
      stroke(
        [
          [-0.01, 0.6],
          [0.5, 0.58],
          [1.01, 0.6],
        ],
        0.42,
      ),
    ],
  },
  {
    id: "scribble",
    layer: "over",
    fit: "repeat",
    strokes: [
      stroke(
        sample(16, (t) => [t + 0.08 * Math.sin(t * Math.PI * 4), UNDER + 0.04 * Math.cos(t * Math.PI * 4)]),
      ),
    ],
  },
  {
    id: "box",
    layer: "over",
    fit: "stretch",
    strokes: [
      stroke([
        [-0.04, -0.08],
        [1.03, -0.11],
        [1.05, 0.93],
        [-0.03, 0.95],
        [-0.05, -0.1],
        [0.08, -0.08],
      ]),
    ],
  },
  {
    id: "strike",
    layer: "over",
    fit: "stretch",
    strokes: [
      stroke([
        [-0.02, 0.45],
        [0.5, 0.43],
        [1.02, 0.46],
      ]),
    ],
  },
];

// A black highlighter would hide the text, so marks behind the text fall back to yellow.
export function markColor(color: Color, layer: MarkItem["layer"]): Color {
  return layer === "behind" && color === "ink" ? "sun" : color;
}
