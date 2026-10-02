import assert from "node:assert/strict";
import { test } from "node:test";
import {
  MAX_ZOOM,
  MIN_ZOOM,
  screenToWorld,
  worldToScreen,
  zoomAt,
  type Viewport,
} from "../src/editor/viewport.ts";
import { between, seeded, type Random } from "./random.ts";

function randomView(random: Random): Viewport {
  return {
    x: between(random, -1e6, 1e6),
    y: between(random, -1e6, 1e6),
    zoom: between(random, MIN_ZOOM, MAX_ZOOM),
  };
}

function close(actual: number, expected: number): boolean {
  return Math.abs(actual - expected) <= 1e-9 * Math.max(1, Math.abs(expected));
}

test("V1: screen and world mapping are inverse", () => {
  const random = seeded(5);
  for (let i = 0; i < 10_000; i++) {
    const view = randomView(random);
    const point = [between(random, -1e6, 1e6), between(random, -1e6, 1e6)] as const;
    const [x, y] = screenToWorld(view, worldToScreen(view, point));
    assert.ok(close(x, point[0]) && close(y, point[1]), `case ${i}`);
  }
});

test("V2: zooming keeps the world point under the anchor", () => {
  const random = seeded(6);
  for (let i = 0; i < 10_000; i++) {
    const view = randomView(random);
    const anchor = [between(random, 0, 4000), between(random, 0, 3000)] as const;
    const before = screenToWorld(view, anchor);
    const after = screenToWorld(zoomAt(view, anchor, between(random, 0.5, 2)), anchor);
    assert.ok(close(after[0], before[0]) && close(after[1], before[1]), `case ${i}`);
  }
});

test("V3: zoom stays within its bounds", () => {
  const random = seeded(7);
  for (let i = 0; i < 1000; i++) {
    let view = randomView(random);
    for (let step = 0; step < 50; step++) {
      view = zoomAt(view, [0, 0], between(random, 0.01, 100));
      assert.ok(view.zoom >= MIN_ZOOM && view.zoom <= MAX_ZOOM);
    }
  }
});
