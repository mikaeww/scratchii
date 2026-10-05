// Corner lists of closed outlines: the presets the shape tools draw, fitting corners into a box and back, and
// the inside test. Not here: finding polygons in strokes (src/recognize) or drawing them (outline.ts).
import type { Vec } from "../editor/viewport.ts";
import type { PolygonItem } from "../model/item.ts";
import { boxAround, type Box } from "./box.ts";

export type Corner = readonly [number, number];
export type PolygonKind = "triangle" | "diamond" | "star";

// Inner radius of the five-pointed star as a fraction of the outer one; the pentagram's own ratio.
const STAR_INNER = 0.382;

export function fitCorners(points: readonly Corner[]): { box: Box; corners: Corner[] } {
  const box = boxAround(points);
  const corners = points.map(([x, y]): Corner => [
    box.width === 0 ? 0 : (x - box.x) / box.width,
    box.height === 0 ? 0 : (y - box.y) / box.height,
  ]);
  return { box, corners };
}

function star(): Corner[] {
  const points = Array.from({ length: 10 }, (_, i): Corner => {
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    const radius = i % 2 === 0 ? 1 : STAR_INNER;
    return [Math.cos(angle) * radius, Math.sin(angle) * radius];
  });
  return fitCorners(points).corners;
}

export const PRESET_CORNERS: Readonly<Record<PolygonKind, readonly Corner[]>> = {
  triangle: [
    [0.5, 0],
    [1, 1],
    [0, 1],
  ],
  diamond: [
    [0.5, 0],
    [1, 0.5],
    [0.5, 1],
    [0, 0.5],
  ],
  star: star(),
};

export function placeCorners(box: Box, corners: readonly Corner[]): Vec[] {
  return corners.map(([u, v]) => [box.x + u * box.width, box.y + v * box.height]);
}

export function polygonCorners(item: PolygonItem): Vec[] {
  return placeCorners({ x: item.x, y: item.y, width: item.width, height: item.height }, item.corners);
}

// Even-odd rule, the same one SVG and canvas use to fill the outline.
export function insidePolygon([px, py]: Vec, corners: readonly Vec[]): boolean {
  let inside = false;
  for (let i = 0, j = corners.length - 1; i < corners.length; j = i++) {
    const [xi, yi] = corners[i] ?? [0, 0];
    const [xj, yj] = corners[j] ?? [0, 0];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
