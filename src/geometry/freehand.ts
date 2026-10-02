// Turns pen points into the filled outline of a felt-marker stroke, as SVG path data.
// Not here: colour or drawing; the outline is the same for canvas and SVG export.
import { getStroke } from "perfect-freehand";
import type { Size, StrokePoint } from "../model/item.ts";

export const PEN_WIDTH: Record<Size, number> = { s: 4, m: 7, l: 12 };

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

export function strokePath(points: readonly StrokePoint[], size: Size, pressure: boolean): string {
  const outline = getStroke(
    points.map(([x, y, p]) => [x, y, p]),
    {
      size: PEN_WIDTH[size],
      thinning: pressure ? 0.6 : 0.45,
      smoothing: 0.6,
      streamline: 0.45,
      simulatePressure: !pressure,
      last: true,
    },
  );
  return outlineToPath(outline);
}
