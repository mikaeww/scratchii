// Line widths and font sizes per size step, in world units. Shared by geometry, rendering and editing.
import type { Item, Size } from "../model/item.ts";

export const PEN_WIDTH: Readonly<Record<Size, number>> = { s: 4, m: 7, l: 12 };
export const SHAPE_WIDTH: Readonly<Record<Size, number>> = { s: 2.5, m: 4, l: 6 };
export const FONT_SIZE: Readonly<Record<Size, number>> = { s: 20, m: 28, l: 40 };
export const NOTE_FONT_SIZE: Readonly<Record<Size, number>> = { s: 18, m: 22, l: 28 };
export const LINE_HEIGHT = 1.3;
export const NOTE_PADDING = 16;

// How far drawn ink reaches beyond the stored geometry.
export function inkReach(item: Item): number {
  switch (item.type) {
    case "stroke":
      return PEN_WIDTH[item.size] / 2;
    case "text":
      return 0;
    default:
      return SHAPE_WIDTH[item.size] / 2;
  }
}
