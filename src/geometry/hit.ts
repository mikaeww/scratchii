// Whether a world point touches an item, with a tolerance in world units. Not here: which item is on top.
import type { Vec } from "../editor/viewport.ts";
import type { Item } from "../model/item.ts";
import { shapeBox } from "./bounds.ts";
import { contains, grow, type Box } from "./box.ts";
import { insidePolygon, polygonCorners } from "./polygon.ts";
import { inkReach } from "./widths.ts";

export function segmentDistance([px, py]: Vec, [ax, ay]: Vec, [bx, by]: Vec): number {
  const dx = bx - ax;
  const dy = by - ay;
  const length = dx * dx + dy * dy;
  const t = length === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / length));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function nearPolyline(
  point: Vec,
  origin: Vec,
  points: readonly (readonly number[])[],
  reach: number,
): boolean {
  const at = (i: number): Vec => [origin[0] + (points[i]?.[0] ?? 0), origin[1] + (points[i]?.[1] ?? 0)];
  if (points.length === 1) return Math.hypot(point[0] - at(0)[0], point[1] - at(0)[1]) <= reach;
  for (let i = 1; i < points.length; i++) {
    if (segmentDistance(point, at(i - 1), at(i)) <= reach) return true;
  }
  return false;
}

function insideEllipse([px, py]: Vec, box: Box): boolean {
  const rx = box.width / 2;
  const ry = box.height / 2;
  if (rx === 0 || ry === 0) return false;
  const nx = (px - box.x - rx) / rx;
  const ny = (py - box.y - ry) / ry;
  return nx * nx + ny * ny <= 1;
}

function onOutline(point: Vec, box: Box, reach: number, ellipse: boolean): boolean {
  const outer = grow(box, reach);
  const inner = grow(box, -reach);
  if (ellipse)
    return (
      insideEllipse(point, outer) && !(inner.width > 0 && inner.height > 0 && insideEllipse(point, inner))
    );
  return contains(outer, point) && !(inner.width > 0 && inner.height > 0 && contains(inner, point));
}

export function hitItem(item: Item, point: Vec, tolerance: number): boolean {
  const reach = inkReach(item) + tolerance;
  switch (item.type) {
    case "stroke":
    case "line":
    case "arrow":
      return nearPolyline(point, [item.x, item.y], item.points, reach);
    case "rect":
    case "ellipse": {
      const box = shapeBox(item);
      if (item.fill === null) return onOutline(point, box, reach, item.type === "ellipse");
      return item.type === "ellipse"
        ? insideEllipse(point, grow(box, reach))
        : contains(grow(box, reach), point);
    }
    case "polygon": {
      const corners = polygonCorners(item);
      const closed = [...corners, ...corners.slice(0, 1)];
      const onEdge = nearPolyline(point, [0, 0], closed, reach);
      return onEdge || (item.fill !== null && insidePolygon(point, corners));
    }
    case "text":
    case "note":
    case "image":
    case "graph":
    case "chart":
      return contains(grow(shapeBox(item), reach), point);
    // Marks are reached through their text (context menu), never picked on their own.
    case "mark":
      return false;
  }
}

// Topmost first: the last item in the list is drawn last and wins.
export function itemAt(items: readonly Item[], point: Vec, tolerance: number): Item | null {
  for (let i = items.length - 1; i >= 0; i--) {
    const item = items[i];
    if (item !== undefined && !item.deleted && hitItem(item, point, tolerance)) return item;
  }
  return null;
}
