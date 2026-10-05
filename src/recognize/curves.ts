// Fits one gentle bend to an open pen path: the quadratic curve through both ends whose middle is the path's
// middle (src/geometry/outline.ts). Waves, S shapes and scribbles do not fit and stay strokes.
import { segmentDistance } from "../geometry/hit.ts";
import { bendThrough, curvePoints } from "../geometry/outline.ts";
import { distance, resample, type Point } from "./path.ts";

// Below this the line counts as straight; above it a quadratic no longer looks like what was drawn.
const MIN_BEND = 0.06;
const MAX_BEND = 0.6;
// The worst distance of the stroke from the fitted curve, relative to the chord.
const CURVE_ERROR = 0.06;

export function curveBend(points: readonly Point[]): number | null {
  const even = resample(points, 65);
  const [a, middle, b] = [even[0], even[32], even.at(-1)];
  if (a === undefined || middle === undefined || b === undefined) return null;
  const chord = distance(a, b);
  if (chord === 0) return null;
  const bend = bendThrough(a, b, middle);
  if (Math.abs(bend) < MIN_BEND || Math.abs(bend) > MAX_BEND) return null;
  const curve = curvePoints(a, b, bend, 64);
  const off = (p: Point): number =>
    Math.min(...curve.slice(1).map((q, i) => segmentDistance(p, curve[i] ?? q, q)));
  const worst = Math.max(...even.map(off));
  return worst / chord < CURVE_ERROR ? bend : null;
}
