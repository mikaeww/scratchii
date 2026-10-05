// Tidies recognised polygon corners the way a drawing program does: four corners near right angles become an
// exact rectangle, nearly level or upright edges become exactly so, and a triangle's apex nearly over the middle
// or an end of its level base moves exactly there. Not here: finding the corners (polygons.ts).
import { distance, type Point } from "./path.ts";

const DEGREE = Math.PI / 180;
// A rectangle leaning less than this is drawn level; a steeper one keeps its lean.
const LEAN = 12 * DEGREE;
const RIGHT_ANGLE_SLACK = 25 * DEGREE;
// Edges this close to level or upright become exactly level or upright.
const EDGE_SLACK = 10 * DEGREE;
// How far the apex may sit from the middle or an end of the base, relative to the base length.
const APEX_SLACK = 0.08;

function cornerAngle(corners: readonly Point[], i: number): number {
  const at = (k: number): Point => corners[(k + corners.length) % corners.length] ?? [0, 0];
  const [a, b, c] = [at(i - 1), at(i), at(i + 1)];
  const u = Math.atan2(a[1] - b[1], a[0] - b[0]);
  const v = Math.atan2(c[1] - b[1], c[0] - b[0]);
  const angle = Math.abs(u - v);
  return Math.min(angle, 2 * Math.PI - angle);
}

function rotate([x, y]: Point, centre: Point, angle: number): Point {
  const [dx, dy] = [x - centre[0], y - centre[1]];
  const [cos, sin] = [Math.cos(angle), Math.sin(angle)];
  return [centre[0] + dx * cos - dy * sin, centre[1] + dx * sin + dy * cos];
}

// Edge directions folded onto a quarter turn and averaged as vectors weighted by length, so 89° and -89° agree.
function lean(corners: readonly Point[]): number {
  let [sx, sy] = [0, 0];
  corners.forEach((corner, i) => {
    const next = corners[(i + 1) % corners.length] ?? corner;
    const turn = 4 * Math.atan2(next[1] - corner[1], next[0] - corner[0]);
    sx += Math.cos(turn) * distance(corner, next);
    sy += Math.sin(turn) * distance(corner, next);
  });
  const angle = Math.atan2(sy, sx) / 4;
  return Math.abs(angle) < LEAN ? 0 : angle;
}

function rectangle(corners: readonly Point[]): Point[] | null {
  if (corners.length !== 4) return null;
  if (corners.some((_, i) => Math.abs(cornerAngle(corners, i) - Math.PI / 2) > RIGHT_ANGLE_SLACK))
    return null;
  const angle = lean(corners);
  const centre: Point = [
    corners.reduce((sum, [x]) => sum + x, 0) / 4,
    corners.reduce((sum, [, y]) => sum + y, 0) / 4,
  ];
  const upright = corners.map((corner) => rotate(corner, centre, -angle));
  const xs = upright.map(([x]) => x).sort((a, b) => a - b);
  const ys = upright.map(([, y]) => y).sort((a, b) => a - b);
  const mean = (values: number[], from: number): number =>
    ((values[from] ?? 0) + (values[from + 1] ?? 0)) / 2;
  const [left, right, top, bottom] = [mean(xs, 0), mean(xs, 2), mean(ys, 0), mean(ys, 2)];
  const box: Point[] = [
    [left, top],
    [right, top],
    [right, bottom],
    [left, bottom],
  ];
  return angle === 0 ? box : box.map((corner) => rotate(corner, centre, angle));
}

function levelEdges(corners: readonly Point[]): Point[] {
  const out = [...corners];
  out.forEach((_, i) => {
    const j = (i + 1) % out.length;
    const [a, b] = [out[i] ?? [0, 0], out[j] ?? [0, 0]];
    const [dx, dy] = [Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1])];
    if (dy <= Math.tan(EDGE_SLACK) * dx) {
      const y = (a[1] + b[1]) / 2;
      [out[i], out[j]] = [
        [a[0], y],
        [b[0], y],
      ];
    } else if (dx <= Math.tan(EDGE_SLACK) * dy) {
      const x = (a[0] + b[0]) / 2;
      [out[i], out[j]] = [
        [x, a[1]],
        [x, b[1]],
      ];
    }
  });
  return out;
}

function settleApex(corners: Point[]): Point[] {
  if (corners.length !== 3) return corners;
  return corners.map((apex, i) => {
    const a = corners[(i + 1) % 3] ?? apex;
    const b = corners[(i + 2) % 3] ?? apex;
    if (a[1] !== b[1]) return apex;
    const slack = APEX_SLACK * Math.abs(b[0] - a[0]);
    const target = [(a[0] + b[0]) / 2, a[0], b[0]].find((x) => Math.abs(apex[0] - x) < slack);
    return target === undefined ? apex : [target, apex[1]];
  });
}

export function straighten(corners: readonly Point[]): Point[] {
  return rectangle(corners) ?? settleApex(levelEdges(corners));
}
