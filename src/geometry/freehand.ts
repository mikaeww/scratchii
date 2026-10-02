// Turns pen points into the filled outline of a felt-marker stroke, as SVG path data.
// Not here: colour or drawing; the outline is the same for canvas and SVG export.
import { getStroke } from "perfect-freehand";
import type { Size, StrokePoint } from "../model/item.ts";
import { PEN_WIDTH } from "./widths.ts";

function average(a: number, b: number): number {
  return (a + b) / 2;
}

// Closed quadratic curve through the midpoints of the outline, the smoothest path for the fewest commands.
export function outlineToPath(outline: readonly number[][]): string {
  const count = outline.length;
  if (count < 4) return "";
  const at = (i: number): [number, number] => {
    const point = outline[i % count];
    return [point?.[0] ?? 0, point?.[1] ?? 0];
  };
  const [x0, y0] = at(0);
  const [x1, y1] = at(1);
  const [x2, y2] = at(2);
  let d = `M${x0.toFixed(2)},${y0.toFixed(2)} Q${x1.toFixed(2)},${y1.toFixed(2)} `;
  d += `${average(x1, x2).toFixed(2)},${average(y1, y2).toFixed(2)} T`;
  for (let i = 2; i < count - 1; i++) {
    const [ax, ay] = at(i);
    const [bx, by] = at(i + 1);
    d += `${average(ax, bx).toFixed(2)},${average(ay, by).toFixed(2)} `;
  }
  return `${d}Z`;
}

export interface FreehandOptions {
  readonly width: number;
  readonly pressure: boolean;
  // 0 keeps the width even; higher values let speed or pressure thin the line.
  readonly thinning: number;
}

export function freehandPath(points: readonly (readonly number[])[], options: FreehandOptions): string {
  const outline = getStroke(
    points.map(([x = 0, y = 0, p = 0.5]) => [x, y, p]),
    {
      size: options.width,
      thinning: options.thinning,
      smoothing: 0.6,
      streamline: 0.45,
      simulatePressure: !options.pressure,
      last: true,
    },
  );
  return outlineToPath(outline);
}

export function strokePath(points: readonly StrokePoint[], size: Size, pressure: boolean): string {
  return freehandPath(points, { width: PEN_WIDTH[size], pressure, thinning: pressure ? 0.6 : 0.45 });
}
