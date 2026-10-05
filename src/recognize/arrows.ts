// Arrows drawn in two strokes: first the shaft (straight or with one bend), then the head as a separate "V"
// whose tip sits on an end of the shaft. Finds the head in the held stroke and joins it with the shaft.
// Not here: arrows drawn in one stroke (shapes.ts).
import { distance, pathLength, resample, type Point } from "./path.ts";
import { recogniseShape } from "./shapes.ts";

export interface Head {
  readonly tip: Point;
  // The middle between the two wing ends; the arrow points from here to the tip.
  readonly back: Point;
  readonly size: number;
}

// The angle between the wings, and how unequal they may be.
const MIN_OPENING = (20 * Math.PI) / 180;
const MAX_OPENING = (130 * Math.PI) / 180;
const MAX_LEG_RATIO = 2.5;
// Each wing strays at most this far from straight, relative to its length.
const LEG_STRAIGHTNESS = 0.18;
// How close the tip must be to an end of the shaft, relative to the head size, and how well the shaft must
// run into the head (cosine of the angle between the two directions).
const TIP_REACH = 0.8;
const MIN_ALIGNMENT = 0.5;

function farthestFromChord(points: readonly Point[], a: Point, b: Point): number {
  let [best, index] = [-1, 0];
  points.forEach(([x, y], i) => {
    const d = Math.abs((b[0] - a[0]) * (a[1] - y) - (a[0] - x) * (b[1] - a[1]));
    if (d > best) [best, index] = [d, i];
  });
  return index;
}

function bow(points: readonly Point[]): number {
  const a = points[0];
  const b = points.at(-1);
  if (a === undefined || b === undefined) return Infinity;
  const length = distance(a, b);
  const i = farthestFromChord(points, a, b);
  const p = points[i] ?? a;
  return length === 0
    ? Infinity
    : Math.abs((b[0] - a[0]) * (a[1] - p[1]) - (a[0] - p[0]) * (b[1] - a[1])) / length / length;
}

export function recogniseHead(raw: readonly Point[]): Head | null {
  const points = resample(raw, 32);
  const [a, b] = [points[0], points.at(-1)];
  if (a === undefined || b === undefined || pathLength(points) === 0) return null;
  const tipIndex = farthestFromChord(points, a, b);
  const tip = points[tipIndex] ?? a;
  const [one, two] = [distance(a, tip), distance(b, tip)];
  if (one === 0 || two === 0 || Math.max(one, two) / Math.min(one, two) > MAX_LEG_RATIO) return null;
  if (bow(points.slice(0, tipIndex + 1)) > LEG_STRAIGHTNESS || bow(points.slice(tipIndex)) > LEG_STRAIGHTNESS)
    return null;
  const opening = Math.acos(
    ((a[0] - tip[0]) * (b[0] - tip[0]) + (a[1] - tip[1]) * (b[1] - tip[1])) / (one * two),
  );
  if (opening < MIN_OPENING || opening > MAX_OPENING) return null;
  return { tip, back: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], size: (one + two) / 2 };
}

// The arrow from the shaft's far end to the head's tip, or null when the head does not sit on an end of the
// shaft or does not point on along it. The bend is measured in the arrow's own direction.
export function joinHead(
  shaft: readonly Point[],
  head: Head,
): { from: Point; to: Point; bend: number } | null {
  const [start, end] = [shaft[0], shaft.at(-1)];
  if (start === undefined || end === undefined) return null;
  const atEnd = distance(end, head.tip) <= distance(start, head.tip);
  const ordered = atEnd ? shaft : [...shaft].reverse();
  const [from, near] = [ordered[0] ?? start, ordered.at(-1) ?? end];
  if (distance(near, head.tip) > TIP_REACH * head.size) return null;
  const into = resample(ordered, 16);
  const before = into.at(-3) ?? from;
  const [dx, dy] = [near[0] - before[0], near[1] - before[1]];
  const [hx, hy] = [head.tip[0] - head.back[0], head.tip[1] - head.back[1]];
  const alignment = (dx * hx + dy * hy) / (Math.hypot(dx, dy) * Math.hypot(hx, hy) || 1);
  if (alignment < MIN_ALIGNMENT) return null;
  // Only a straight or once-bent line is a shaft; anything else stays the stroke it was.
  const line = recogniseShape(ordered);
  if (line?.kind !== "line") return null;
  return { from: line.from, to: head.tip, bend: line.bend };
}
