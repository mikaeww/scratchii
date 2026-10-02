// Decides whether a marker stroke highlights text: which text, which lines and which part of them.
// Pure: the caller passes the measured line boxes of the texts in view.
import type { Box } from "../geometry/box.ts";

type Point = readonly [number, number];

export interface TextLines {
  readonly id: string;
  readonly lines: readonly Box[];
}

export interface Highlight {
  readonly target: string;
  readonly lines: readonly [number, number];
  // Covered part of the lines in u (0 = line start, 1 = line end).
  readonly from: number;
  readonly to: number;
}

// Share of the stroke's points that must lie in a line's band for the line to count as covered.
const MIN_SHARE = 0.2;
const FULL_LINE = 0.85;

function inBand(point: Point, line: Box): boolean {
  const margin = line.height;
  return (
    point[1] >= line.y &&
    point[1] <= line.y + line.height &&
    point[0] >= line.x - margin &&
    point[0] <= line.x + line.width + margin
  );
}

function covered(points: readonly Point[], text: TextLines): { lines: number[]; inside: Point[] } {
  const lines: number[] = [];
  const inside: Point[] = [];
  text.lines.forEach((line, index) => {
    if (line.width <= 0) return;
    const hits = points.filter((point) => inBand(point, line));
    if (hits.length >= Math.max(2, MIN_SHARE * points.length)) {
      lines.push(index);
      inside.push(...hits);
    }
  });
  return { lines, inside };
}

export function recogniseHighlight(points: readonly Point[], texts: readonly TextLines[]): Highlight | null {
  let best: { text: TextLines; lines: number[]; inside: Point[] } | null = null;
  for (const text of texts) {
    const found = covered(points, text);
    if (found.lines.length > 0 && found.inside.length > (best?.inside.length ?? 0)) best = { text, ...found };
  }
  if (best === null) return null;
  const first = best.lines[0] ?? 0;
  const last = best.lines.at(-1) ?? first;
  const reference = best.text.lines[first];
  if (reference === undefined) return null;
  const xs = best.inside.map(([x]) => x);
  const clamp = (u: number): number => Math.min(1, Math.max(0, u));
  const from = clamp((Math.min(...xs) - reference.x) / reference.width);
  const to = clamp((Math.max(...xs) - reference.x) / reference.width);
  const full = to - from >= FULL_LINE;
  return { target: best.text.id, lines: [first, last], from: full ? 0 : from, to: full ? 1 : to };
}
