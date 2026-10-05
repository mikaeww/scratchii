// Seeded random numbers and sample data for property tests, so a failing seed can be replayed.
import { PRESETS } from "../src/annotate/presets.ts";
import { createBoard, putItems, type Board } from "../src/model/board.ts";
import {
  COLORS,
  ITEM_TYPES,
  SIZES,
  createItem,
  type Color,
  type ImageItem,
  type Item,
  type ItemType,
  type LineItem,
  type MarkItem,
  type NoteItem,
  type PolygonItem,
  type GraphItem,
  type ChartItem,
  type TableItem,
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
  polygon: (random) =>
    createItem<PolygonItem>({
      ...base(random),
      type: "polygon",
      width: between(random, 0, 1000),
      height: between(random, 0, 1000),
      fill: random() < 0.5 ? null : pick(random, COLORS),
      corners: Array.from({ length: 3 + Math.floor(random() * 8) }, () => [random(), random()] as const),
      label: random() < 0.5 ? "" : "ja",
    }),
  graph: (random) => {
    const [x0, y0] = [between(random, -50, 0), between(random, -50, 0)];
    return createItem<GraphItem>({
      ...base(random),
      type: "graph",
      width: between(random, 1, 800),
      height: between(random, 1, 800),
      functions: random() < 0.5 ? ["sin(x)", "x^2 - 3"] : ["2x + 1"],
      range: [x0, x0 + between(random, 0.1, 100), y0, y0 + between(random, 0.1, 100)],
    });
  },
  chart: (random) => {
    const count = 1 + Math.floor(random() * 8);
    return createItem<ChartItem>({
      ...base(random),
      type: "chart",
      width: between(random, 1, 800),
      height: between(random, 1, 800),
      kind: random() < 0.5 ? "bar" : "line",
      labels: Array.from({ length: count }, (_, i) => `L${i}`),
      values: Array.from({ length: count }, () => between(random, -100, 100)),
    });
  },
  table: (random) => {
    const [rows, columns] = [1 + Math.floor(random() * 12), 1 + Math.floor(random() * 8)];
    const shares = (count: number): number[] => {
      const raw = Array.from({ length: count }, () => between(random, 0.2, 1));
      const sum = raw.reduce((a, b) => a + b, 0);
      return raw.map((r) => r / sum);
    };
    return createItem<TableItem>({
      ...base(random),
      type: "table",
      width: between(random, 1, 1200),
      height: between(random, 1, 900),
      cells: Array.from({ length: rows }, (_, r) =>
        Array.from({ length: columns }, (_, c) => (random() < 0.3 ? "" : `${r}:${c}`)),
      ),
      columns: shares(columns),
      rows: shares(rows),
    });
  },
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
  image: (random) =>
    createItem<ImageItem>({
      ...base(random),
      type: "image",
      width: between(random, 1, 800),
      height: between(random, 1, 800),
      src: "data:image/png;base64,iVBORw0KGgo=",
    }),
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
    label: random() < 0.5 ? "" : "Antrag prüfen",
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
    label: random() < 0.5 ? "" : "nein",
    // Ids that need not exist: validation only checks the shape of the field, rerouting drops missing ones.
    ends: [random() < 0.3 ? crypto.randomUUID() : null, null],
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
