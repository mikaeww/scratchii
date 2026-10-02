// Seeded random numbers and sample data for property tests, so a failing seed can be replayed.
import { PRESETS } from "../src/annotate/presets.ts";
import { createBoard, putItems, type Board } from "../src/model/board.ts";
import {
  COLORS,
  ITEM_TYPES,
  SIZES,
  createItem,
  type Color,
  type Item,
  type ItemType,
  type LineItem,
  type MarkItem,
  type NoteItem,
  type ShapeItem,
  type Size,
  type StrokeItem,
  type TextItem,
} from "../src/model/item.ts";

export type Random = () => number;

// mulberry32: tiny, fast, good enough to spread test cases; not for anything secret.
export function seeded(seed: number): Random {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 2 ** 32;
  };
}

export function between(random: Random, low: number, high: number): number {
  return low + random() * (high - low);
}

export function pick<T>(random: Random, values: readonly T[]): T {
  const value = values[Math.floor(random() * values.length)];
  if (value === undefined) throw new Error("invariant: pick needs a non-empty list");
  return value;
}

function base(random: Random): { x: number; y: number; color: Color; size: Size } {
  return {
    x: between(random, -1e5, 1e5),
    y: between(random, -1e5, 1e5),
    color: pick(random, COLORS),
    size: pick(random, SIZES),
  };
}

const MAKERS: Readonly<Record<ItemType, (random: Random) => Item>> = {
  stroke: (random) =>
    createItem<StrokeItem>({
      ...base(random),
      type: "stroke",
      points: Array.from({ length: Math.floor(between(random, 1, 40)) }, () => {
        return [between(random, -500, 500), between(random, -500, 500), random()] as const;
      }),
      pressure: random() < 0.5,
      tip: random() < 0.5 ? "pen" : "marker",
    }),
  rect: (random) => shape(random, "rect"),
  ellipse: (random) => shape(random, "ellipse"),
  line: (random) => line(random, "line"),
  arrow: (random) => line(random, "arrow"),
  text: (random) =>
    createItem<TextItem>({
      ...base(random),
      type: "text",
      text: random() < 0.5 ? "Hello" : "two\nlines",
      fontSize: between(random, 8, 80),
      width: between(random, 1, 800),
      height: between(random, 1, 300),
    }),
  mark: (random) => randomMark(random, crypto.randomUUID()),
  note: (random) =>
    createItem<NoteItem>({
      ...base(random),
      type: "note",
      text: "Note",
      width: between(random, 40, 600),
      height: between(random, 40, 600),
      fill: pick(random, COLORS),
    }),
};

export function randomMark(random: Random, target: string): MarkItem {
  const preset = pick(random, PRESETS);
  const first = Math.floor(random() * 3);
  return createItem<MarkItem>({
    ...base(random),
    x: 0,
    y: 0,
    type: "mark",
    target,
    lines: random() < 0.5 ? null : [first, first + Math.floor(random() * 3)],
    layer: preset.layer,
    fit: preset.fit,
    strokes: preset.strokes,
  });
}

function shape(random: Random, type: ShapeItem["type"]): ShapeItem {
  return createItem<ShapeItem>({
    ...base(random),
    type,
    width: between(random, 0, 1000),
    height: between(random, 0, 1000),
    fill: random() < 0.5 ? null : pick(random, COLORS),
  });
}

function line(random: Random, type: LineItem["type"]): LineItem {
  return createItem<LineItem>({
    ...base(random),
    type,
    points: [
      [0, 0],
      [between(random, -800, 800), between(random, -800, 800)],
    ],
  });
}

export function randomItem(random: Random, type: ItemType = pick(random, ITEM_TYPES)): Item {
  return MAKERS[type](random);
}

// Items with geometry of their own: everything but marks, which follow their text.
export function randomPlaced(random: Random): Item {
  return randomItem(
    random,
    pick(
      random,
      ITEM_TYPES.filter((type) => type !== "mark"),
    ),
  );
}

export function randomBoard(random: Random): Board {
  const items = Array.from({ length: Math.floor(between(random, 0, 12)) }, () => randomItem(random));
  return { ...putItems(createBoard(`Board ${random()}`), items), tags: random() < 0.5 ? ["a", "b c"] : [] };
}
