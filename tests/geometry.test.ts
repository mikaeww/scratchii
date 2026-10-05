import assert from "node:assert/strict";
import { test } from "node:test";
import { boundsOf, shapeBox } from "../src/geometry/bounds.ts";
import { contains, grow, type Box } from "../src/geometry/box.ts";
import { hitItem } from "../src/geometry/hit.ts";
import { polygonCorners } from "../src/geometry/polygon.ts";
import { moveItem, scaleItem } from "../src/geometry/transform.ts";
import type { Item } from "../src/model/item.ts";
import { between, randomPlaced, seeded } from "./random.ts";

const EPSILON = 1e-6;

function storedPoints(item: Item): [number, number][] {
  switch (item.type) {
    case "stroke":
    case "line":
    case "arrow":
      return item.points.map(([x, y]) => [item.x + x, item.y + y]);
    case "polygon":
      return polygonCorners(item).map(([x, y]) => [x, y]);
    case "mark":
      return [[item.x, item.y]];
    default:
      return [
        [item.x, item.y],
        [item.x + item.width, item.y + item.height],
      ];
  }
}

function closeBox(actual: Box, expected: Box): boolean {
  const near = (a: number, b: number): boolean => Math.abs(a - b) <= EPSILON * Math.max(1, Math.abs(b));
  return (
    near(actual.x, expected.x) &&
    near(actual.y, expected.y) &&
    near(actual.width, expected.width) &&
    near(actual.height, expected.height)
  );
}

test("G1: bounds contain all stored geometry", () => {
  const random = seeded(10);
  for (let i = 0; i < 2000; i++) {
    const item = randomPlaced(random);
    const bounds = grow(boundsOf(item), EPSILON);
    for (const point of storedPoints(item)) assert.ok(contains(bounds, point), `case ${i} ${item.type}`);
  }
});

test("G2: centres of filled items and stored points of strokes, lines and polygons are hits", () => {
  const random = seeded(11);
  for (let i = 0; i < 2000; i++) {
    const item = randomPlaced(random);
    if (item.type === "stroke" || item.type === "line" || item.type === "arrow" || item.type === "polygon") {
      for (const point of storedPoints(item)) assert.ok(hitItem(item, point, 0), `case ${i} ${item.type}`);
    } else if ((item.type !== "rect" && item.type !== "ellipse") || item.fill !== null) {
      const box = shapeBox(item);
      assert.ok(hitItem(item, [box.x + box.width / 2, box.y + box.height / 2], 0), `case ${i} ${item.type}`);
    }
  }
});

test("G3: points well outside the bounds never hit", () => {
  const random = seeded(12);
  for (let i = 0; i < 2000; i++) {
    const item = randomPlaced(random);
    const tolerance = between(random, 0, 10);
    const outside = grow(boundsOf(item), tolerance + 1);
    for (let k = 0; k < 20; k++) {
      const angle = random() * Math.PI * 2;
      const cx = outside.x + outside.width / 2;
      const cy = outside.y + outside.height / 2;
      const far = Math.hypot(outside.width, outside.height) / 2 + between(random, 0.01, 500);
      const point = [cx + Math.cos(angle) * far, cy + Math.sin(angle) * far] as const;
      assert.ok(!hitItem(item, point, tolerance), `case ${i} ${item.type}`);
    }
  }
});

test("G4: moving shifts the bounds exactly", () => {
  const random = seeded(13);
  for (let i = 0; i < 2000; i++) {
    const item = randomPlaced(random);
    const dx = between(random, -1000, 1000);
    const dy = between(random, -1000, 1000);
    const before = boundsOf(item);
    const after = boundsOf(moveItem(item, dx, dy));
    assert.ok(closeBox(after, { ...before, x: before.x + dx, y: before.y + dy }), `case ${i}`);
  }
});

test("G5: scaling maps the geometric box from one box to another", () => {
  const random = seeded(14);
  for (let i = 0; i < 2000; i++) {
    const item = randomPlaced(random);
    const from = shapeBox(item);
    const width = between(random, 1, 2000);
    // A bent line keeps its bend relative to its chord, which is exact only when both sides scale alike.
    const bent = (item.type === "line" || item.type === "arrow") && item.bend !== 0 && from.width > 0;
    const to = {
      x: between(random, -1e4, 1e4),
      y: between(random, -1e4, 1e4),
      width,
      height: bent ? (width * from.height) / from.width : between(random, 1, 2000),
    };
    const scaled = shapeBox(scaleItem(item, from, to));
    if (item.type === "text") {
      const factor = Math.min(
        from.width === 0 ? 1 : to.width / from.width,
        from.height === 0 ? 1 : to.height / from.height,
      );
      const expected = { x: to.x, y: to.y, width: from.width * factor, height: from.height * factor };
      assert.ok(closeBox(scaled, expected), `case ${i} text`);
    } else {
      const expected = {
        ...to,
        width: from.width === 0 ? 0 : to.width,
        height: from.height === 0 ? 0 : to.height,
      };
      assert.ok(closeBox(scaled, expected), `case ${i} ${item.type}`);
    }
  }
});
