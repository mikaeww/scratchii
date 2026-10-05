// Moving and scaling items as plain field changes. Not here: versions (the caller wraps with updateItem).
import type { Item } from "../model/item.ts";
import type { Box } from "./box.ts";
import { shapeBox } from "./bounds.ts";
import { bendThrough, curveMiddle } from "./outline.ts";

export function moveItem<T extends Item>(item: T, dx: number, dy: number): T {
  if (item.type === "mark") return item;
  return { ...item, x: item.x + dx, y: item.y + dy };
}

// Maps the item from the box `from` to the box `to`; `from` is usually the selection box.
export function scaleItem<T extends Item>(item: T, from: Box, to: Box): T {
  const sx = from.width === 0 ? 1 : to.width / from.width;
  const sy = from.height === 0 ? 1 : to.height / from.height;
  const mapX = (x: number): number => to.x + (x - from.x) * sx;
  const mapY = (y: number): number => to.y + (y - from.y) * sy;
  const x = mapX(item.x);
  const y = mapY(item.y);
  switch (item.type) {
    case "stroke":
      return { ...item, x, y, points: item.points.map(([px, py, p]) => [px * sx, py * sy, p] as const) };
    case "line":
    case "arrow": {
      const [[ax, ay], [bx, by]] = item.points;
      const [a, b] = [[ax * sx, ay * sy] as const, [bx * sx, by * sy] as const];
      // The curve's middle moves with the scale; the bend that runs through it is exact for even scaling and
      // close for uneven scaling, where a true quadratic would lean to one side.
      const [mx, my] = curveMiddle(item.points[0], item.points[1], item.bend);
      const bend = item.bend === 0 ? 0 : bendThrough(a, b, [mx * sx, my * sy]);
      return { ...item, x, y, points: [a, b], bend };
    }
    case "text": {
      const scale = Math.min(sx, sy);
      const box = shapeBox(item);
      return {
        ...item,
        x,
        y,
        fontSize: item.fontSize * scale,
        width: box.width * scale,
        height: box.height * scale,
      };
    }
    case "mark":
      return item;
    default:
      return { ...item, x, y, width: item.width * sx, height: item.height * sy };
  }
}
