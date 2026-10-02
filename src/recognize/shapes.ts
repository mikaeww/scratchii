// Classifies one pen stroke as a line, arrow, box or ellipse, or as nothing. Heuristics on a resampled path,
// tuned on generated strokes (docs/verification/recognize.md); no learning, no rotation.
import { boxAround, type Box } from "../geometry/box.ts";

type Point = readonly [number, number];

export type Shape =
  | { readonly kind: "line" | "arrow"; readonly from: Point; readonly to: Point }
  | { readonly kind: "rect" | "ellipse"; readonly box: Box };

const SAMPLES = 64;
// World units; shorter strokes are dots or ticks, never shapes.
const MIN_LENGTH = 24;
// A straight stroke strays at most this far from its chord (relative to the chord) and is nearly as short.
const MAX_DEVIATION = 0.07;
const MIN_CHORD_RATIO = 0.85;
const CLOSED_GAP = 0.2;
const RECT_CORNER = 0.09;
const ELLIPSE_ERROR = 0.12;
const RECT_EDGE_ERROR = 0.06;

function distance(a: Point, b: Point): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

function pathLength(points: readonly Point[]): number {
  let length = 0;
  for (let i = 1; i < points.length; i++)
    length += distance(points[i - 1] ?? points[i] ?? [0, 0], points[i] ?? [0, 0]);
  return length;
}

// Evenly spaced points along the path, so fast and slow parts of a stroke weigh the same.
export function resample(points: readonly Point[], count: number): Point[] {
  const total = pathLength(points);
  const first = points[0];
  if (first === undefined || total === 0) return first === undefined ? [] : [first];
  const step = total / (count - 1);
  const out: Point[] = [first];
  let carried = 0;
  for (let i = 1; i < points.length && out.length < count; i++) {
    let a = points[i - 1] ?? first;
    const b = points[i] ?? a;
    let segment = distance(a, b);
    while (carried + segment >= step && out.length < count) {
      const t = (step - carried) / segment;
      a = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
      out.push(a);
      segment = distance(a, b);
      carried = 0;
    }
    carried += segment;
  }
  const last = points.at(-1) ?? first;
  while (out.length < count) out.push(last);
  return out;
}

function deviation(points: readonly Point[], a: Point, b: Point): number {
  const chord = distance(a, b);
  if (chord === 0) return Infinity;
  const worst = Math.max(
    ...points.map(([x, y]) => Math.abs((b[0] - a[0]) * (a[1] - y) - (a[0] - x) * (b[1] - a[1])) / chord),
  );
  return worst / chord;
}

function straight(points: readonly Point[]): boolean {
  const a = points[0];
  const b = points.at(-1);
  if (a === undefined || b === undefined) return false;
  return deviation(points, a, b) < MAX_DEVIATION && distance(a, b) / pathLength(points) > MIN_CHORD_RATIO;
}

function arrow(points: readonly Point[], length: number): Shape | null {
  const start = points[0];
  if (start === undefined) return null;
  // The pen passes the tip twice (out to the first wing and back); the first visit ends the shaft.
  const farthest = Math.max(...points.map((point) => distance(point, start)));
  const tipIndex = Math.max(
    0,
    points.findIndex((point) => distance(point, start) >= 0.97 * farthest),
  );
  const tip = points[tipIndex] ?? start;
  const shaft = points.slice(0, tipIndex + 1);
  const shaftLength = pathLength(shaft);
  const head = points.slice(tipIndex);
  const headLength = length - shaftLength;
  if (shaftLength === 0 || !straight(shaft)) return null;
  if (headLength < 0.12 * shaftLength || headLength > 0.9 * shaftLength) return null;
  const nearTip = head.every((point) => distance(point, tip) <= 0.45 * shaftLength);
  return nearTip ? { kind: "arrow", from: start, to: tip } : null;
}

function closedShape(points: readonly Point[]): Shape | null {
  const box = boxAround(points);
  if (box.width < MIN_LENGTH / 2 || box.height < MIN_LENGTH / 2) return null;
  const diagonal = Math.hypot(box.width, box.height);
  const corners: Point[] = [
    [box.x, box.y],
    [box.x + box.width, box.y],
    [box.x, box.y + box.height],
    [box.x + box.width, box.y + box.height],
  ];
  const cornerGap =
    Math.max(...corners.map((c) => Math.min(...points.map((p) => distance(p, c))))) / diagonal;
  const side = Math.min(box.width, box.height);
  const edgeError =
    points.reduce((sum, [x, y]) => {
      const edge = Math.min(x - box.x, box.x + box.width - x, y - box.y, box.y + box.height - y);
      return sum + Math.abs(edge);
    }, 0) /
    points.length /
    side;
  if (cornerGap < RECT_CORNER && edgeError < RECT_EDGE_ERROR) return { kind: "rect", box };
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const ellipseError =
    points.reduce(
      (sum, [x, y]) =>
        sum + Math.abs(Math.hypot((x - cx) / (box.width / 2), (y - cy) / (box.height / 2)) - 1),
      0,
    ) / points.length;
  return ellipseError < ELLIPSE_ERROR ? { kind: "ellipse", box } : null;
}

export function recogniseShape(raw: readonly Point[]): Shape | null {
  const length = pathLength(raw);
  if (length < MIN_LENGTH) return null;
  const points = resample(raw, SAMPLES);
  const start = points[0];
  const end = points.at(-1);
  if (start === undefined || end === undefined) return null;
  if (straight(points)) return { kind: "line", from: start, to: end };
  if (distance(start, end) < CLOSED_GAP * length) return closedShape(points);
  return arrow(points, pathLength(points));
}
