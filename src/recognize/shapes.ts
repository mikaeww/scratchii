// Classifies one pen stroke as a line, arrow, box, ellipse or polygon, or as nothing, and cleans it up: nearly
// round becomes a circle, nearly square a square, nearly level lines level. Heuristics on a resampled path,
// tuned on generated strokes (docs/verification/recognize.md); no learning.
import { boxAround, type Box } from "../geometry/box.ts";
import { distance, pathLength, resample, type Point } from "./path.ts";
import { recognisePolygon } from "./polygons.ts";

export type Shape =
  | { readonly kind: "line" | "arrow"; readonly from: Point; readonly to: Point }
  | { readonly kind: "rect" | "ellipse"; readonly box: Box }
  | { readonly kind: "polygon"; readonly corners: readonly Point[] };

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
// Side ratios above these snap to a circle or a square; line angles this close to a 45° step snap onto it.
const ROUND_RATIO = 0.85;
const SQUARE_RATIO = 0.9;
const LEVEL_DEGREES = 5;

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

// Nearly square boxes become square around the same centre.
function evened(box: Box, ratio: number): Box {
  if (Math.min(box.width, box.height) < ratio * Math.max(box.width, box.height)) return box;
  const side = (box.width + box.height) / 2;
  return {
    x: box.x + (box.width - side) / 2,
    y: box.y + (box.height - side) / 2,
    width: side,
    height: side,
  };
}

// Nearly level or diagonal lines turn about their middle onto the 45° step, so both ends move only a little.
function levelled(from: Point, to: Point): readonly [Point, Point] {
  const angle = Math.atan2(to[1] - from[1], to[0] - from[0]);
  const step = Math.PI / 4;
  const target = Math.round(angle / step) * step;
  if (Math.abs(target - angle) > (LEVEL_DEGREES * Math.PI) / 180) return [from, to];
  const half = distance(from, to) / 2;
  const [cx, cy] = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2];
  const [dx, dy] = [Math.cos(target) * half, Math.sin(target) * half];
  return [
    [cx - dx, cy - dy],
    [cx + dx, cy + dy],
  ];
}

function isRect(points: readonly Point[], box: Box): boolean {
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
  return cornerGap < RECT_CORNER && edgeError < RECT_EDGE_ERROR;
}

function ellipseError(points: readonly Point[], box: Box): number {
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  return (
    points.reduce(
      (sum, [x, y]) =>
        sum + Math.abs(Math.hypot((x - cx) / (box.width / 2), (y - cy) / (box.height / 2)) - 1),
      0,
    ) / points.length
  );
}

// Straightened four-corner polygons with only level and upright edges are plain boxes.
function levelBox(corners: readonly Point[]): boolean {
  return (
    corners.length === 4 &&
    corners.every((corner, i) => {
      const next = corners[(i + 1) % 4] ?? corner;
      return corner[0] === next[0] || corner[1] === next[1];
    })
  );
}

function closedShape(points: readonly Point[], raw: readonly Point[]): Shape | null {
  const box = boxAround(points);
  if (box.width < MIN_LENGTH / 2 || box.height < MIN_LENGTH / 2) return null;
  if (isRect(points, box)) return { kind: "rect", box: evened(box, SQUARE_RATIO) };
  const corners = recognisePolygon(raw);
  if (corners !== null && levelBox(corners))
    return { kind: "rect", box: evened(boxAround(corners), SQUARE_RATIO) };
  if (corners !== null) return { kind: "polygon", corners };
  return ellipseError(points, box) < ELLIPSE_ERROR
    ? { kind: "ellipse", box: evened(box, ROUND_RATIO) }
    : null;
}

function straightened(shape: Shape | null): Shape | null {
  if (shape === null || !("from" in shape)) return shape;
  const [from, to] = levelled(shape.from, shape.to);
  return { ...shape, from, to };
}

export function recogniseShape(raw: readonly Point[]): Shape | null {
  const length = pathLength(raw);
  if (length < MIN_LENGTH) return null;
  const points = resample(raw, SAMPLES);
  const start = points[0];
  const end = points.at(-1);
  if (start === undefined || end === undefined) return null;
  if (straight(points)) return straightened({ kind: "line", from: start, to: end });
  if (distance(start, end) < CLOSED_GAP * length) return closedShape(points, raw);
  return straightened(arrow(points, pathLength(points)));
}
