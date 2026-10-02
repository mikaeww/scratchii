// Axis-aligned boxes in world coordinates. Not here: which box an item has (bounds.ts).
import type { Vec } from "../editor/viewport.ts";

export interface Box {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export function boxFromPoints(a: Vec, b: Vec): Box {
  return {
    x: Math.min(a[0], b[0]),
    y: Math.min(a[1], b[1]),
    width: Math.abs(b[0] - a[0]),
    height: Math.abs(b[1] - a[1]),
  };
}

export function boxAround(points: readonly (readonly number[])[]): Box {
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  for (const [x = 0, y = 0] of points) {
    left = Math.min(left, x);
    top = Math.min(top, y);
    right = Math.max(right, x);
    bottom = Math.max(bottom, y);
  }
  if (left === Infinity) return { x: 0, y: 0, width: 0, height: 0 };
  return { x: left, y: top, width: right - left, height: bottom - top };
}

export function grow(box: Box, by: number): Box {
  return { x: box.x - by, y: box.y - by, width: box.width + 2 * by, height: box.height + 2 * by };
}

export function unite(boxes: readonly Box[]): Box | null {
  if (boxes.length === 0) return null;
  return boxAround(
    boxes.flatMap((b) => [
      [b.x, b.y],
      [b.x + b.width, b.y + b.height],
    ]),
  );
}

export function overlaps(a: Box, b: Box): boolean {
  return a.x <= b.x + b.width && b.x <= a.x + a.width && a.y <= b.y + b.height && b.y <= a.y + a.height;
}

export function contains(box: Box, [x, y]: Vec): boolean {
  return x >= box.x && x <= box.x + box.width && y >= box.y && y <= box.y + box.height;
}
