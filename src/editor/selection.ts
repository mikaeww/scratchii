// The box around the selected items, its corner handles, and the bend handle of a single selected line.
// Shared by the select tool and the overlay.
import { boundsOf, shapeBox } from "../geometry/bounds.ts";
import { boxFromPoints, unite, type Box } from "../geometry/box.ts";
import { curveMiddle } from "../geometry/outline.ts";
import type { Item, LineItem } from "../model/item.ts";
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

// One line or arrow alone gets a handle at its middle that bends it.
export function bendable(items: readonly Item[]): LineItem | null {
  const [only, ...rest] = items;
  return rest.length === 0 && (only?.type === "line" || only?.type === "arrow") ? only : null;
}

export function bendHandle(line: LineItem, view: Viewport): Vec {
  const [a, b] = line.points;
  const [mx, my] = curveMiddle(a, b, line.bend);
  return worldToScreen(view, [line.x + mx, line.y + my]);
}

export function onBendHandle(line: LineItem, view: Viewport, screen: Vec): boolean {
  const [x, y] = bendHandle(line, view);
  return Math.hypot(screen[0] - x, screen[1] - y) <= HANDLE_GRAB;
}

export function endHandles(line: LineItem, view: Viewport): [Vec, Vec] {
  const [[ax, ay], [bx, by]] = line.points;
  return [worldToScreen(view, [line.x + ax, line.y + ay]), worldToScreen(view, [line.x + bx, line.y + by])];
}

export function onEndHandle(line: LineItem, view: Viewport, screen: Vec): 0 | 1 | null {
  const index = endHandles(line, view).findIndex(
    ([x, y]) => Math.hypot(screen[0] - x, screen[1] - y) <= HANDLE_GRAB,
  );
  return index === 0 || index === 1 ? index : null;
}
