// Items are the things on a board: immutable values carrying a version and a nonce for sync merges.
// Not here: how items look (src/geometry, src/render) or how they are edited (src/editor).

export const COLORS = ["ink", "coral", "violet", "teal", "sun", "pink", "orange", "sky", "paper"] as const;
export type Color = (typeof COLORS)[number];

export const SIZES = ["s", "m", "l"] as const;
export type Size = (typeof SIZES)[number];

// x, y relative to the item origin, pressure in [0, 1].
export type StrokePoint = readonly [x: number, y: number, pressure: number];

export interface ItemBase {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly color: Color;
  readonly size: Size;
  // Drives the hand-drawn wobble, so an item looks the same on every render and every device.
  readonly seed: number;
  readonly version: number;
  readonly nonce: number;
  readonly deleted: boolean;
  // Milliseconds since the epoch.
  readonly updated: number;
}

export interface StrokeItem extends ItemBase {
  readonly type: "stroke";
  readonly points: readonly StrokePoint[];
  // False for mice and touch without pressure; the renderer then simulates pressure from speed.
  readonly pressure: boolean;
}

export interface ShapeItem extends ItemBase {
  readonly type: "rect" | "ellipse";
  // Always positive; the item origin is the top-left corner.
  readonly width: number;
  readonly height: number;
  readonly fill: Color | null;
}

// Start and end relative to the item origin; the start is (0, 0) when drawn.
export interface LineItem extends ItemBase {
  readonly type: "line" | "arrow";
  readonly points: readonly [readonly [number, number], readonly [number, number]];
}

// Width and height are measured when the text is edited, so geometry never needs the DOM.
export interface TextItem extends ItemBase {
  readonly type: "text";
  readonly text: string;
  readonly fontSize: number;
  readonly width: number;
  readonly height: number;
}

export interface NoteItem extends ItemBase {
  readonly type: "note";
  readonly text: string;
  readonly width: number;
  readonly height: number;
  readonly fill: Color;
}

export type Item = StrokeItem | ShapeItem | LineItem | TextItem | NoteItem;
export type ItemType = Item["type"];
export const ITEM_TYPES: readonly ItemType[] = ["stroke", "rect", "ellipse", "line", "arrow", "text", "note"];

type Fresh<T extends Item> = Omit<T, "id" | "seed" | "version" | "nonce" | "deleted" | "updated">;
type Changes<T extends Item> = Partial<Omit<T, "id" | "type" | "seed" | "version" | "nonce" | "updated">>;

function randomInt(): number {
  return Math.floor(Math.random() * 2 ** 31);
}

export function createItem<T extends Item>(fields: Fresh<T>): T {
  return {
    ...fields,
    id: crypto.randomUUID(),
    seed: randomInt(),
    version: 1,
    nonce: randomInt(),
    deleted: false,
    updated: Date.now(),
  } as T;
}

// `next` is an edited copy of a stored item that still carries the stored version.
export function reviseItem<T extends Item>(next: T): T {
  return { ...next, version: next.version + 1, nonce: randomInt(), updated: Date.now() };
}

export function updateItem<T extends Item>(item: T, changes: Changes<T>): T {
  return reviseItem({ ...item, ...changes });
}
