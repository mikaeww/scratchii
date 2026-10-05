import assert from "node:assert/strict";
import { test } from "node:test";
import { ATTACH_GAP, attachPoint, reroute, rerouted } from "../src/diagram/connect.ts";
import { shapeBox } from "../src/geometry/bounds.ts";
import { PRESET_CORNERS, polygonCorners } from "../src/geometry/polygon.ts";
import { scaleItem } from "../src/geometry/transform.ts";
import { createItem, type Item, type LineItem } from "../src/model/item.ts";
import { validateItem } from "../src/model/validate.ts";
import { between, pick, randomItem, seeded, type Random } from "./random.ts";

const TARGETS = ["rect", "ellipse", "polygon", "note", "text", "image", "graph", "chart", "table"] as const;

function target(random: Random): Item {
  // Away from zero size, where "on the outline" stops meaning anything.
  const generic = randomItem(random, pick(random, TARGETS));
  // The polygons the app makes: presets, not the self-crossing corner soup of the generic random items.
  const item =
    generic.type === "polygon"
      ? { ...generic, corners: pick(random, Object.values(PRESET_CORNERS)) }
      : generic;
  const box = shapeBox(item);
  return scaleItem(item, box, {
    x: box.x,
    y: box.y,
    width: between(random, 20, 600),
    height: between(random, 20, 600),
  });
}

function segmentDistance(
  p: readonly [number, number],
  a: readonly [number, number],
  b: readonly [number, number],
): number {
  const [dx, dy] = [b[0] - a[0], b[1] - a[1]];
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}

// Distance from the point, pulled back toward the centre by the gap, to the item's outline.
function offOutline(item: Item, point: readonly [number, number]): number {
  const box = shapeBox(item);
  const centre = [box.x + box.width / 2, box.y + box.height / 2] as const;
  const length = Math.hypot(point[0] - centre[0], point[1] - centre[1]);
  const back = [
    point[0] - ((point[0] - centre[0]) / length) * ATTACH_GAP,
    point[1] - ((point[1] - centre[1]) / length) * ATTACH_GAP,
  ] as const;
  if (item.type === "ellipse") {
    const [rx, ry] = [box.width / 2, box.height / 2];
    return (
      Math.abs(Math.hypot((back[0] - centre[0]) / rx, (back[1] - centre[1]) / ry) - 1) * Math.min(rx, ry)
    );
  }
  const corners =
    item.type === "polygon"
      ? polygonCorners(item)
      : ([
          [box.x, box.y],
          [box.x + box.width, box.y],
          [box.x + box.width, box.y + box.height],
          [box.x, box.y + box.height],
        ] as const);
  return Math.min(
    ...corners.map((corner, i) => segmentDistance(back, corner, corners[(i + 1) % corners.length] ?? corner)),
  );
}

// Shortest distance from the point to the item's outline, sampled finely.
function nearOutline(item: Item, point: readonly [number, number]): number {
  const box = shapeBox(item);
  if (item.type === "ellipse") {
    const [cx, cy, rx, ry] = [box.x + box.width / 2, box.y + box.height / 2, box.width / 2, box.height / 2];
    return Math.min(
      ...Array.from({ length: 2000 }, (_, k) => {
        const t = (k / 2000) * Math.PI * 2;
        return Math.hypot(point[0] - cx - Math.cos(t) * rx, point[1] - cy - Math.sin(t) * ry);
      }),
    );
  }
  const corners =
    item.type === "polygon"
      ? polygonCorners(item)
      : ([
          [box.x, box.y],
          [box.x + box.width, box.y],
          [box.x + box.width, box.y + box.height],
          [box.x, box.y + box.height],
        ] as const);
  return Math.min(
    ...corners.map((c, i) => segmentDistance(point, c, corners[(i + 1) % corners.length] ?? c)),
  );
}

function arrowBetween(a: Item | null, b: Item | null, random: Random): LineItem {
  return createItem<LineItem>({
    type: "arrow",
    x: between(random, -500, 500),
    y: between(random, -500, 500),
    color: "ink",
    size: "m",
    points: [
      [0, 0],
      [between(random, -300, 300), between(random, -300, 300)],
    ],
    label: "",
    ends: [a?.id ?? null, b?.id ?? null],
  });
}

test("K1: an attached end sits on its target's outline, pushed out by the gap", () => {
  const random = seeded(70);
  for (let i = 0; i < 2000; i++) {
    const item = target(random);
    const angle = random() * Math.PI * 2;
    const box = shapeBox(item);
    const toward = [
      box.x + box.width / 2 + Math.cos(angle) * 1000,
      box.y + box.height / 2 + Math.sin(angle) * 1000,
    ] as const;
    const point = attachPoint(item, toward);
    // Convex outlines meet the ray once; for star-shaped polygons the farthest edge is used, also on the outline.
    assert.ok(offOutline(item, point) < 1e-6 * Math.max(1, box.width, box.height), `case ${i} ${item.type}`);
  }
});

test("K2 + K4: after targets move or scale, ends are back on their outlines, and rerouting again changes nothing", () => {
  const random = seeded(71);
  for (let i = 0; i < 1000; i++) {
    const [a, b] = [target(random), target(random)];
    const line = arrowBetween(a, random() < 0.8 ? b : null, random);
    const first = rerouted(line, new Map([a, b, line].map((item) => [item.id, item]))) ?? line;
    const moved = [a, b].map((item) => {
      const box = shapeBox(item);
      return scaleItem(item, box, {
        x: box.x + between(random, -400, 400),
        y: box.y + between(random, -400, 400),
        width: between(random, 20, 600),
        height: between(random, 20, 600),
      });
    });
    const scene: Item[] = [...moved, first];
    const [after] = reroute(scene, false);
    const result = after ?? first;
    const [[ax, ay], [bx, by]] = result.points;
    const ends = [
      [result.x + ax, result.y + ay],
      [result.x + bx, result.y + by],
    ] as const;
    result.ends.forEach((id, k) => {
      const item = moved.find((m) => m.id === id);
      if (item === undefined) return;
      const box = shapeBox(item);
      assert.ok(
        offOutline(item, ends[k] ?? [0, 0]) < 1e-6 * Math.max(1, box.width, box.height),
        `case ${i} end ${k}`,
      );
    });
    assert.deepEqual(reroute([...moved, result], false), [], `case ${i}: second reroute changed something`);
  }
});

test("K3: a deleted target drops the attachment and keeps the point; free lines never change", () => {
  const random = seeded(72);
  for (let i = 0; i < 500; i++) {
    const a = target(random);
    const line = arrowBetween(a, null, random);
    const placed = rerouted(line, new Map([[a.id, a]])) ?? line;
    const gone = { ...a, deleted: true };
    const [after] = reroute([gone, placed], false);
    assert.ok(after !== undefined, `case ${i}`);
    assert.deepEqual(after.ends, [null, null]);
    assert.equal(after.x, placed.x);
    assert.deepEqual(after.points, placed.points);
    assert.deepEqual(reroute([arrowBetween(null, null, random), target(random)], false), []);
  }
});

test("K5: items written before labels and ends load with empty ones", () => {
  const base = {
    id: "a",
    x: 0,
    y: 0,
    color: "ink",
    size: "m",
    seed: 1,
    version: 1,
    nonce: 1,
    deleted: false,
    updated: 1,
  };
  const box = validateItem({ ...base, type: "rect", width: 10, height: 10, fill: null }, "item");
  assert.equal(box.type === "rect" ? box.label : null, "");
  const arrow = validateItem(
    {
      ...base,
      type: "arrow",
      points: [
        [0, 0],
        [5, 5],
      ],
    },
    "item",
  );
  assert.deepEqual(arrow.type === "arrow" ? [arrow.label, arrow.ends] : null, ["", [null, null]]);
  assert.throws(() =>
    validateItem(
      {
        ...base,
        type: "arrow",
        points: [
          [0, 0],
          [5, 5],
        ],
        ends: ["x"],
      },
      "item",
    ),
  );
});

test("K6: two lines between the same two items lie apart, each end still on its outline", () => {
  const random = seeded(73);
  for (let i = 0; i < 500; i++) {
    const [a, b] = [target(random), target(random)];
    const there = arrowBetween(a, b, random);
    const back = arrowBetween(b, a, random);
    const placed = reroute([a, b, there, back], false);
    const byId = new Map(placed.map((line) => [line.id, line]));
    const [one, two] = [byId.get(there.id) ?? there, byId.get(back.id) ?? back];
    const middle = (line: LineItem): [number, number] => {
      const [[ax, ay], [bx, by]] = line.points;
      return [line.x + (ax + bx) / 2, line.y + (ay + by) / 2];
    };
    const [m1, m2] = [middle(one), middle(two)];
    const boxA = shapeBox(a);
    const boxB = shapeBox(b);
    const centres = Math.hypot(
      boxA.x + boxA.width / 2 - boxB.x - boxB.width / 2,
      boxA.y + boxA.height / 2 - boxB.y - boxB.height / 2,
    );
    // Overlapping items have no room between them to tell two lines apart.
    if (centres < Math.max(boxA.width, boxA.height, boxB.width, boxB.height)) continue;
    assert.ok(Math.hypot(m1[0] - m2[0], m1[1] - m2[1]) > 10, `case ${i}: the two lines overlap`);
    // Ends start from a point beside the centre, so they meet the outline at a slant: within the gap of it.
    for (const line of [one, two]) {
      const [[ax, ay], [bx, by]] = line.points;
      const ends = [
        [line.x + ax, line.y + ay],
        [line.x + bx, line.y + by],
      ] as const;
      line.ends.forEach((id, k) => {
        const item = id === a.id ? a : b;
        assert.ok(
          // 0.1 covers sampling the ellipse at 2000 points; boxes and polygons are exact.
          nearOutline(item, ends[k] ?? [0, 0]) <= ATTACH_GAP + 0.1,
          `case ${i}: end ${k} off the outline`,
        );
      });
    }
  }
});
