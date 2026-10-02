import assert from "node:assert/strict";
import { test } from "node:test";
import { recogniseShape, type Shape } from "../src/recognize/shapes.ts";
import { seeded } from "./random.ts";
import { NOT_SHAPE_KINDS, arrow, ellipse, line, notShape, rect, type Point, type Sample } from "./strokes.ts";

const PER_CLASS = 500;
const GENERATORS = { line, arrow, rect, ellipse } as const;

function close(a: number, b: number, scale: number): boolean {
  return Math.abs(a - b) <= 0.1 * scale;
}

function accurate(sample: Sample, shape: Shape): boolean {
  if ("box" in shape) {
    const box = sample.box;
    if (box === undefined) return false;
    const r = shape.box;
    return (
      close(r.x, box.x, box.width) &&
      close(r.x + r.width, box.x + box.width, box.width) &&
      close(r.y, box.y, box.height) &&
      close(r.y + r.height, box.y + box.height, box.height)
    );
  }
  const [from, to] = sample.ends ?? [];
  if (from === undefined || to === undefined) return false;
  const length = Math.hypot(to[0] - from[0], to[1] - from[1]);
  const near = (a: Point, b: Point): boolean => Math.hypot(a[0] - b[0], a[1] - b[1]) <= 0.1 * length;
  return near(shape.from, from) && near(shape.to, to);
}

test("R1 + R3: generated shapes are recognised as their class, in the right place", (t) => {
  const random = seeded(30);
  for (const [kind, generate] of Object.entries(GENERATORS)) {
    let right = 0;
    let placed = 0;
    for (let i = 0; i < PER_CLASS; i++) {
      const sample = generate(random);
      const shape = recogniseShape(sample.points);
      if (shape?.kind !== kind) continue;
      right++;
      if (accurate(sample, shape)) placed++;
    }
    t.diagnostic(`R1 ${kind}: ${right}/${PER_CLASS} recognised, R3 ${placed}/${right} placed`);
    assert.ok(right >= PER_CLASS * 0.95, `${kind}: only ${right}/${PER_CLASS}`);
    assert.equal(placed, right, `${kind}: ${right - placed} misplaced`);
  }
});

test("R2: generated non-shapes are rarely taken for shapes", (t) => {
  const random = seeded(31);
  for (const kind of NOT_SHAPE_KINDS) {
    let wrong = 0;
    for (let i = 0; i < PER_CLASS; i++) if (recogniseShape(notShape(random, kind)) !== null) wrong++;
    t.diagnostic(`R2 ${kind}: ${wrong}/${PER_CLASS} taken for a shape`);
    assert.ok(wrong <= PER_CLASS * 0.05, `${kind}: ${wrong}/${PER_CLASS} false shapes`);
  }
});

import { recogniseHighlight, type TextLines } from "../src/recognize/highlight.ts";
import { between } from "./random.ts";

function randomText(random: () => number, id: string): TextLines {
  const x = between(random, -1000, 1000);
  const y = between(random, -1000, 1000);
  const h = between(random, 20, 60);
  const count = 1 + Math.floor(random() * 4);
  return {
    id,
    lines: Array.from({ length: count }, (_, i) => ({
      x,
      y: y + i * h,
      width: between(random, 100, 600),
      height: h,
    })),
  };
}

function horizontal(x0: number, x1: number, y: number): Point[] {
  return Array.from({ length: 30 }, (_, i) => [x0 + ((x1 - x0) * i) / 29, y]);
}

test("R4 + R6: a stroke along line k highlights that line over the covered part", () => {
  const random = seeded(32);
  for (let i = 0; i < 1000; i++) {
    const text = randomText(random, "t");
    const k = Math.floor(random() * text.lines.length);
    const line = text.lines[k];
    if (line === undefined) continue;
    // Starts at most a tenth of the line before it, so at least half of the stroke is over the line.
    const x0 = line.x + between(random, -0.1, 0.7) * line.width;
    const x1 = x0 + between(random, 0.2, 0.8) * line.width;
    const result = recogniseHighlight(horizontal(x0, x1, line.y + between(random, 0.2, 0.8) * line.height), [
      text,
    ]);
    assert.ok(result !== null, `case ${i}`);
    assert.equal(result.target, "t");
    assert.deepEqual(result.lines, [k, k], `case ${i}`);
    const clamp = (u: number): number => Math.min(1, Math.max(0, u));
    const from = clamp((Math.max(x0, line.x - line.height) - line.x) / line.width);
    const to = clamp((Math.min(x1, line.x + line.width + line.height) - line.x) / line.width);
    const full = to - from >= 0.85;
    assert.ok(
      Math.abs(result.from - (full ? 0 : from)) < 1e-9 && Math.abs(result.to - (full ? 1 : to)) < 1e-9,
      `case ${i}`,
    );
  }
});

test("R5: strokes away from every line highlight nothing", () => {
  const random = seeded(33);
  for (let i = 0; i < 1000; i++) {
    const text = randomText(random, "t");
    const last = text.lines.at(-1);
    if (last === undefined) continue;
    const y = last.y + last.height + between(random, 1, 400);
    assert.equal(recogniseHighlight(horizontal(last.x, last.x + 200, y), [text]), null, `case ${i}`);
  }
});
