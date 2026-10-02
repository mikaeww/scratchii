// Seeded random numbers and sample data for property tests, so a failing seed can be replayed.
import { createBoard, putItems, type Board } from "../src/model/board.ts";
import { COLORS, SIZES, createItem, type Item, type StrokeItem } from "../src/model/item.ts";

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

export function randomItem(random: Random): Item {
  const points = Array.from({ length: Math.floor(between(random, 1, 40)) }, () => {
    return [between(random, -500, 500), between(random, -500, 500), random()] as const;
  });
  return createItem<StrokeItem>({
    type: "stroke",
    x: between(random, -1e5, 1e5),
    y: between(random, -1e5, 1e5),
    color: pick(random, COLORS),
    size: pick(random, SIZES),
    points,
    pressure: random() < 0.5,
  });
}

export function randomBoard(random: Random): Board {
  const items = Array.from({ length: Math.floor(between(random, 0, 12)) }, () => randomItem(random));
  return { ...putItems(createBoard(`Board ${random()}`), items), tags: random() < 0.5 ? ["a", "b c"] : [] };
}
