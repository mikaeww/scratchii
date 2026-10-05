// Clean outlines of shapes, notes, lines and arrows as SVG path data in item-local coordinates: true ellipses,
// straight edges, one open arrow head. Not here: colour, width or drawing (src/render).
import type { LineItem, NoteItem, PolygonItem, ShapeItem } from "../model/item.ts";
import { SHAPE_WIDTH } from "./widths.ts";

const ARROW_ANGLE = Math.PI / 6.5;

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

export function boxOutline(item: ShapeItem | PolygonItem | NoteItem): string {
  const w = round(item.width);
  const h = round(item.height);
  switch (item.type) {
    case "ellipse": {
      const [rx, ry] = [round(item.width / 2), round(item.height / 2)];
      return `M0 ${ry}A${rx} ${ry} 0 1 0 ${w} ${ry}A${rx} ${ry} 0 1 0 0 ${ry}Z`;
    }
    case "polygon":
      return `${item.corners
        .map(([u, v], i) => `${i === 0 ? "M" : "L"}${round(u * item.width)} ${round(v * item.height)}`)
        .join("")}Z`;
    default:
      return `M0 0H${w}V${h}H0Z`;
  }
}

type Point = readonly [number, number];

// Sample count for curved lines in hit tests and bounds; the error is under a thousandth of the chord.
export const CURVE_SAMPLES = 32;

// The control point of the quadratic curve whose middle lies `bend` chord lengths left of the chord's middle.
// A quadratic curve's middle is halfway between the chord's middle and its control point.
export function controlPoint(a: Point, b: Point, bend: number): Point {
  const [dx, dy] = [b[0] - a[0], b[1] - a[1]];
  return [(a[0] + b[0]) / 2 - 2 * dy * bend, (a[1] + b[1]) / 2 + 2 * dx * bend];
}

export function curveMiddle(a: Point, b: Point, bend: number): Point {
  const [dx, dy] = [b[0] - a[0], b[1] - a[1]];
  return [(a[0] + b[0]) / 2 - dy * bend, (a[1] + b[1]) / 2 + dx * bend];
}

// The bend that puts the curve's middle on the perpendicular through `point`: its offset from the chord's
// middle along the left normal, in chord lengths.
export function bendThrough(a: Point, b: Point, point: Point): number {
  const [dx, dy] = [b[0] - a[0], b[1] - a[1]];
  const squared = dx * dx + dy * dy;
  if (squared === 0) return 0;
  return ((point[0] - (a[0] + b[0]) / 2) * -dy + (point[1] - (a[1] + b[1]) / 2) * dx) / squared;
}

export function curvePoints(a: Point, b: Point, bend: number, count = CURVE_SAMPLES): Point[] {
  const c = controlPoint(a, b, bend);
  return Array.from({ length: count + 1 }, (_, i): Point => {
    const t = i / count;
    const [u, v, w] = [(1 - t) * (1 - t), 2 * (1 - t) * t, t * t];
    return [u * a[0] + v * c[0] + w * b[0], u * a[1] + v * c[1] + w * b[1]];
  });
}

// The line in item-local points: its two ends when straight, the sampled curve when bent.
export function linePoints(item: LineItem): Point[] {
  const [a, b] = item.points;
  return item.bend === 0 ? [a, b] : curvePoints(a, b, item.bend);
}

export function lineOutline(item: LineItem): string {
  const [[ax, ay], [bx, by]] = item.points;
  const [cx, cy] = controlPoint([ax, ay], [bx, by], item.bend);
  const shaft =
    item.bend === 0
      ? `M${round(ax)} ${round(ay)}L${round(bx)} ${round(by)}`
      : `M${round(ax)} ${round(ay)}Q${round(cx)} ${round(cy)} ${round(bx)} ${round(by)}`;
  if (item.type === "line") return shaft;
  // The head follows the curve's direction at its end, which points from the control point to the end.
  const angle = item.bend === 0 ? Math.atan2(by - ay, bx - ax) : Math.atan2(by - cy, bx - cx);
  const head = Math.min(Math.hypot(bx - ax, by - ay) / 2, 10 + SHAPE_WIDTH[item.size] * 4);
  const wing = (side: number): string => {
    const direction = angle + Math.PI + side * ARROW_ANGLE;
    return `${round(bx + Math.cos(direction) * head)} ${round(by + Math.sin(direction) * head)}`;
  };
  // One path through the tip, so the head gets a round join instead of two overlapping caps.
  return `${shaft}M${wing(-1)}L${round(bx)} ${round(by)}L${wing(1)}`;
}
