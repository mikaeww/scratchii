// Lays a mark's normalised strokes onto the line boxes of its text, with a small seeded wobble so two marks
// of the same preset never look stamped. Pure: line widths come from the caller.
import type { Box } from "../geometry/box.ts";
import type { MarkItem } from "../model/item.ts";

// Largest wobble, as a fraction of the line height.
export const WOBBLE = 0.012;

export interface LaidStroke {
  readonly points: readonly (readonly [number, number])[];
  // Width in world units, or null for the pen width of the mark's size.
  readonly width: number | null;
}

// A tiny deterministic hash so the wobble of one point depends only on the mark, line, stroke and index.
function noise(seed: number, a: number, b: number, c: number): number {
  let h =
    (seed ^ Math.imul(a + 1, 0x9e3779b1) ^ Math.imul(b + 1, 0x85ebca6b) ^ Math.imul(c + 1, 0xc2b2ae35)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b) >>> 0;
  return (((h ^ (h >>> 16)) >>> 0) / 2 ** 32) * 2 - 1;
}

function tiled(points: readonly (readonly [number, number])[], periods: number): [number, number][] {
  const out: [number, number][] = [];
  for (let period = 0; period < periods; period++) {
    for (const [index, [u, v]] of points.entries()) {
      if (period > 0 && index === 0) continue;
      out.push([u + period, v]);
    }
  }
  return out;
}

function clipRight(points: [number, number][], limit: number): [number, number][] {
  const kept = points.filter(([u]) => u <= limit);
  return kept.length > 0 ? kept : points.slice(0, 1);
}

export function layOutMark(mark: MarkItem, lines: readonly Box[]): LaidStroke[] {
  const first = mark.lines?.[0] ?? 0;
  const last = Math.min(mark.lines?.[1] ?? lines.length - 1, lines.length - 1);
  const laid: LaidStroke[] = [];
  for (let index = first; index <= last; index++) {
    const line = lines[index];
    if (line === undefined || line.width <= 0) continue;
    const h = line.height;
    for (const [strokeIndex, stroke] of mark.strokes.entries()) {
      const periods = mark.fit === "repeat" ? Math.ceil(line.width / h) : 1;
      const unit = mark.fit === "repeat" ? h : line.width;
      const raw =
        mark.fit === "repeat" ? clipRight(tiled(stroke.points, periods), line.width / h) : stroke.points;
      const points = raw.map(([u, v], i) => {
        const dx = noise(mark.seed, index, strokeIndex, 2 * i) * WOBBLE * h;
        const dy = noise(mark.seed, index, strokeIndex, 2 * i + 1) * WOBBLE * h;
        return [line.x + u * unit + dx, line.y + v * h + dy] as const;
      });
      laid.push({ points, width: stroke.weight === null ? null : stroke.weight * h });
    }
  }
  return laid;
}
