// Maps between world coordinates (where items live) and screen coordinates (CSS pixels of the canvas).
// screen = (world - origin) * zoom. Not here: device pixel ratio, which only the renderer applies.

export interface Viewport {
  // World point shown at the top-left corner of the canvas.
  readonly x: number;
  readonly y: number;
  readonly zoom: number;
}

export type Vec = readonly [x: number, y: number];

export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 8;

export function worldToScreen(view: Viewport, [x, y]: Vec): Vec {
  return [(x - view.x) * view.zoom, (y - view.y) * view.zoom];
}

export function screenToWorld(view: Viewport, [x, y]: Vec): Vec {
  return [x / view.zoom + view.x, y / view.zoom + view.y];
}

export function panBy(view: Viewport, dx: number, dy: number): Viewport {
  return { ...view, x: view.x - dx / view.zoom, y: view.y - dy / view.zoom };
}

// Keeps the world point under `anchor` (screen) where it is.
export function zoomAt(view: Viewport, anchor: Vec, factor: number): Viewport {
  const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, view.zoom * factor));
  const [wx, wy] = screenToWorld(view, anchor);
  return { x: wx - anchor[0] / zoom, y: wy - anchor[1] / zoom, zoom };
}
