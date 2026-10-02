// The world box an item covers, with and without the reach of its ink. Not here: hit tests (hit.ts).
import type { Item } from "../model/item.ts";
import { boxAround, grow, type Box } from "./box.ts";
import { inkReach } from "./widths.ts";

// The stored geometry only: points for strokes and lines, the box for everything else.
export function shapeBox(item: Item): Box {
  switch (item.type) {
    case "stroke":
    case "line":
    case "arrow": {
      const box = boxAround(item.points);
      return { ...box, x: box.x + item.x, y: box.y + item.y };
    }
    default:
      return { x: item.x, y: item.y, width: item.width, height: item.height };
  }
}

export function boundsOf(item: Item): Box {
  return grow(shapeBox(item), inkReach(item));
}
