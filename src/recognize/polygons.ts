// Finds the corners of a closed pen stroke and turns it into a triangle, diamond, star or another polygon with
// up to six corners. Not here: lines, arrows, boxes and ellipses (shapes.ts).
import { boxAround, type Box } from "../geometry/box.ts";
import { segmentDistance } from "../geometry/hit.ts";
import { PRESET_CORNERS, placeCorners } from "../geometry/polygon.ts";
import { distance, pathLength, resample, type Point } from "./path.ts";
import { straighten } from "./straighten.ts";

const SAMPLES = 96;
// Turns are measured over this many samples on each side, wide enough to ignore a shaky hand.
const WINDOW = 4;
// Degrees of turn that make a corner; a drawn circle turns about 15° over a window.
const CORNER_TURN = 40;
// Mean distance of the stroke from the polygon, relative to the box diagonal.
const POLYGON_ERROR = 0.035;
// A polygon's start and end meet more closely than a box's or an ellipse's (relative to the stroke length);
// an M or a W ends near its start too, but the gap is a whole edge.
const POLYGON_GAP = 0.1;
// A drawn outline star has five outer and five inner corners, the outer ones at least this much farther out.
const STAR_SPREAD = 1.4;
// How close a diamond's corners sit to the middles of its box edges, relative to the diagonal.
const DIAMOND_SLACK = 0.08;

// The loop without the overshoot past its start, evenly resampled with the closing gap included; null when the
// ends are too far apart for a polygon.
function closedLoop(points: readonly Point[]): Point[] | null {
  const start = points[0] ?? [0, 0];
  const tail = Math.floor(points.length * 0.65);
  let cut = points.length - 1;
  for (let i = tail; i < points.length; i++) {
    if (distance(points[i] ?? start, start) < distance(points[cut] ?? start, start)) cut = i;
  }
  if (distance(points[cut] ?? start, start) > POLYGON_GAP * pathLength(points)) return null;
  return resample([...points.slice(0, cut + 1), start], SAMPLES + 1).slice(0, SAMPLES);
}

function turn(loop: readonly Point[], i: number): number {
  const at = (k: number): Point => loop[(k + loop.length) % loop.length] ?? [0, 0];
  const [a, b, c] = [at(i - WINDOW), at(i), at(i + WINDOW)];
  const v1 = [b[0] - a[0], b[1] - a[1]] as const;
  const v2 = [c[0] - b[0], c[1] - b[1]] as const;
  return Math.abs(Math.atan2(v1[0] * v2[1] - v1[1] * v2[0], v1[0] * v2[0] + v1[1] * v2[1]));
}

function findCorners(loop: readonly Point[]): Point[] {
  const turns = loop.map((_, i) => turn(loop, i));
  const corners: Point[] = [];
  turns.forEach((angle, i) => {
    if (angle < (CORNER_TURN * Math.PI) / 180) return;
    for (let k = 1; k <= WINDOW; k++) {
      const before = turns[(i - k + turns.length) % turns.length] ?? 0;
      const after = turns[(i + k) % turns.length] ?? 0;
      // Plateaus keep their first sample only.
      if (before >= angle || after > angle) return;
    }
    corners.push(loop[i] ?? [0, 0]);
  });
  return straighten(corners);
}

function fitError(loop: readonly Point[], corners: readonly Point[], box: Box): number {
  const edges = corners.map((corner, i): [Point, Point] => [
    corner,
    corners[(i + 1) % corners.length] ?? corner,
  ]);
  const total = loop.reduce(
    (sum, point) => sum + Math.min(...edges.map(([a, b]) => segmentDistance(point, a, b))),
    0,
  );
  return total / loop.length / Math.hypot(box.width, box.height);
}

function crosses([a, b]: [Point, Point], [c, d]: [Point, Point]): boolean {
  const side = (p: Point, q: Point, r: Point): number =>
    Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
  return side(a, b, c) !== side(a, b, d) && side(c, d, a) !== side(c, d, b);
}

function selfCrossing(corners: readonly Point[]): boolean {
  const edges = corners.map((corner, i): [Point, Point] => [
    corner,
    corners[(i + 1) % corners.length] ?? corner,
  ]);
  return edges.some((edge, i) =>
    edges.some((other, j) => j > i + 1 && !(i === 0 && j === edges.length - 1) && crosses(edge, other)),
  );
}

function isDiamond(corners: readonly Point[], box: Box): boolean {
  const middles = placeCorners(box, PRESET_CORNERS.diamond);
  const slack = DIAMOND_SLACK * Math.hypot(box.width, box.height);
  return middles.every((middle) => corners.some((corner) => distance(corner, middle) < slack));
}

function isOutlineStar(corners: readonly Point[], box: Box): boolean {
  const centre: Point = [box.x + box.width / 2, box.y + box.height / 2];
  const radii = corners.map((corner) => distance(corner, centre));
  const even = radii.filter((_, i) => i % 2 === 0);
  const odd = radii.filter((_, i) => i % 2 === 1);
  const apart = (outer: number[], inner: number[]): boolean =>
    Math.min(...outer) > STAR_SPREAD * Math.max(...inner);
  return apart(even, odd) || apart(odd, even);
}

// World corners of the recognised polygon, straightened, or null when the stroke is no clean polygon.
export function recognisePolygon(points: readonly Point[]): Point[] | null {
  const loop = closedLoop(points);
  if (loop === null) return null;
  const corners = findCorners(loop);
  const box = boxAround(loop);
  const count = corners.length;
  if (count < 3 || count > 10 || fitError(loop, corners, box) > POLYGON_ERROR) return null;
  const star = count === 10 ? isOutlineStar(corners, box) : count === 5 && selfCrossing(corners);
  if (star) return placeCorners(box, PRESET_CORNERS.star);
  if (count > 6 || selfCrossing(corners)) return null;
  if (count === 4 && isDiamond(corners, box)) return placeCorners(box, PRESET_CORNERS.diamond);
  return corners;
}
