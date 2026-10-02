// The box around the selected items and its corner handles. Shared by the select tool and the overlay.
import { boundsOf, shapeBox } from "../geometry/bounds.ts";
import { boxFromPoints, unite, type Box } from "../geometry/box.ts";
import type { Item } from "../model/item.ts";
import { worldToScreen, type Vec, type Viewport } from "./viewport.ts";

export type Handle = "nw" | "ne" | "sw" | "se";

// Screen pixels: the drawn handle size, how far from its centre a press still grabs it, and the gap between
// the items and the dashed frame around them.
export const HANDLE_SIZE = 10;
const HANDLE_GRAB = 9;
const FRAME_GAP = 6;

export function selectionBox(items: readonly Item[]): Box | null {
  return unite(items.map(boundsOf));
}

// The stored geometry without ink reach; resizing maps this box, so items do not creep by half a stroke.
export function geometryBox(items: readonly Item[]): Box | null {
  return unite(items.map(shapeBox));
}

export function corner(box: Box, handle: Handle): Vec {
  return [
    handle.endsWith("w") ? box.x : box.x + box.width,
    handle.startsWith("n") ? box.y : box.y + box.height,
  ];
}

const OPPOSITE: Readonly<Record<Handle, Handle>> = { nw: "se", ne: "sw", sw: "ne", se: "nw" };
export const HANDLES: readonly Handle[] = ["nw", "ne", "sw", "se"];

// The selection frame in screen pixels, a little outside the items so it never covers their ink.
export function frameOf(box: Box, view: Viewport, gap = FRAME_GAP): Box {
  const [x, y] = worldToScreen(view, [box.x, box.y]);
  return {
    x: x - gap,
    y: y - gap,
    width: box.width * view.zoom + 2 * gap,
    height: box.height * view.zoom + 2 * gap,
  };
}

export function handlePoint(frame: Box, handle: Handle): Vec {
  return corner(frame, handle);
}

export function handleAt(box: Box, view: Viewport, screen: Vec): Handle | null {
  const frame = frameOf(box, view);
  for (const handle of HANDLES) {
    const [x, y] = handlePoint(frame, handle);
    if (Math.abs(screen[0] - x) <= HANDLE_GRAB && Math.abs(screen[1] - y) <= HANDLE_GRAB) return handle;
  }
  return null;
}

// The new box when `handle` is dragged to `world`; the opposite corner stays put.
export function resizeBox(box: Box, handle: Handle, world: Vec, keepAspect: boolean): Box {
  const fixed = corner(box, OPPOSITE[handle]);
  if (!keepAspect || box.width === 0 || box.height === 0) return boxFromPoints(fixed, world);
  const scale = Math.max(
    Math.abs(world[0] - fixed[0]) / box.width,
    Math.abs(world[1] - fixed[1]) / box.height,
  );
  const dx = Math.sign(world[0] - fixed[0] || 1) * box.width * scale;
  const dy = Math.sign(world[1] - fixed[1] || 1) * box.height * scale;
  return boxFromPoints(fixed, [fixed[0] + dx, fixed[1] + dy]);
}
