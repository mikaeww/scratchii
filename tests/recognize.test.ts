import assert from "node:assert/strict";
import { test } from "node:test";
import { recogniseShape, type Shape } from "../src/recognize/shapes.ts";
import { seeded } from "./random.ts";
import { boxAround } from "../src/geometry/box.ts";
import {
  NOT_SHAPE_KINDS,
  arrow,
  baseTriangle,
  leaningBox,
  diamond,
  ellipse,
  line,
  notShape,
  rect,
  star,
  triangle,
  type Point,
  type Sample,
} from "./strokes.ts";

const PER_CLASS = 500;
const GENERATORS = { line, arrow, rect, ellipse, triangle, diamond, star } as const;
// Triangles, diamonds and stars all come back as polygons.
const EXPECTED: Readonly<Record<keyof typeof GENERATORS, Shape["kind"]>> = {
  line: "line",
  arrow: "arrow",
  rect: "rect",
  ellipse: "ellipse",
  triangle: "polygon",
  diamond: "polygon",
  star: "polygon",
};

function close(a: number, b: number, scale: number): boolean {
  return Math.abs(a - b) <= 0.1 * scale;
}

function cornersMatch(expected: readonly Point[], found: readonly Point[]): boolean {
  const box = boxAround(expected);
  const slack = 0.1 * Math.hypot(box.width, box.height);
  return (
    expected.length === found.length &&
    expected.every((corner) => found.some((f) => Math.hypot(f[0] - corner[0], f[1] - corner[1]) <= slack))
  );
}

function accurate(sample: Sample, shape: Shape): boolean {
  if (shape.kind === "polygon") {
    if (sample.corners !== undefined) return cornersMatch(sample.corners, shape.corners);
    return sample.box !== undefined && accurate(sample, { kind: "rect", box: boxAround(shape.corners) });
  }
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
      if (shape === null || shape.kind !== EXPECTED[kind as keyof typeof GENERATORS]) continue;
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

test("R8: nearly round, square or level shapes snap; clearly uneven ones keep their proportions", () => {
  const random = seeded(34);
  const ratio = (box: { width: number; height: number }): number =>
    Math.min(box.width, box.height) / Math.max(box.width, box.height);
  for (let i = 0; i < PER_CLASS; i++) {
    for (const generate of [ellipse, rect]) {
      const sample = generate(random);
      const shape = recogniseShape(sample.points);
      if (shape === null || !("box" in shape) || sample.box === undefined) continue;
      const square = shape.box.width === shape.box.height;
      if (ratio(sample.box) >= 0.95) assert.ok(square, `case ${i} ${shape.kind}: not evened`);
      if (ratio(sample.box) <= 0.75) assert.ok(!square, `case ${i} ${shape.kind}: evened`);
    }
    const sample = line(random);
    const shape = recogniseShape(sample.points);
    if (shape === null || !("from" in shape) || sample.ends === undefined) continue;
    const [from, to] = sample.ends;
    const drawn = (Math.atan2(to[1] - from[1], to[0] - from[0]) * 180) / Math.PI;
    const found = (Math.atan2(shape.to[1] - shape.from[1], shape.to[0] - shape.from[0]) * 180) / Math.PI;
    const offStep = Math.abs(drawn / 45 - Math.round(drawn / 45)) * 45;
    if (offStep <= 2) assert.ok(Math.abs(found / 45 - Math.round(found / 45)) < 1e-9, `case ${i}: not level`);
    if (offStep >= 8) assert.ok(Math.abs(found / 45 - Math.round(found / 45)) > 1e-6, `case ${i}: levelled`);
  }
});

function rightAngled(corners: readonly Point[]): boolean {
  return corners.every((corner, i) => {
    const before = corners[(i + 3) % 4] ?? corner;
    const after = corners[(i + 1) % 4] ?? corner;
    const dot =
      (before[0] - corner[0]) * (after[0] - corner[0]) + (before[1] - corner[1]) * (after[1] - corner[1]);
    const scale =
      Math.hypot(before[0] - corner[0], before[1] - corner[1]) *
      Math.hypot(after[0] - corner[0], after[1] - corner[1]);
    return Math.abs(dot) <= 1e-9 * scale;
  });
}

test("R9: sloppy boxes come back level, steep ones as exact rectangles, triangles on a level base", (t) => {
  const random = seeded(35);
  const counts = { level: 0, steep: 0, triangle: 0 };
  for (let i = 0; i < PER_CLASS; i++) {
    const level = recogniseShape(leaningBox(random, 0, 8).points);
    if (level?.kind === "rect") counts.level++;
    const steep = recogniseShape(leaningBox(random, 15, 30).points);
    if (steep?.kind === "polygon" && steep.corners.length === 4) {
      assert.ok(rightAngled(steep.corners), `case ${i}: steep box without right angles`);
      counts.steep++;
    }
    const triangle = recogniseShape(baseTriangle(random).points);
    if (triangle?.kind === "polygon" && triangle.corners.length === 3) {
      const ys = triangle.corners.map(([, y]) => y);
      assert.equal(new Set(ys).size, 2, `case ${i}: base not level`);
      counts.triangle++;
    }
  }
  t.diagnostic(
    `R9 level ${counts.level}, steep ${counts.steep}, triangle ${counts.triangle} of ${PER_CLASS}`,
  );
  for (const [kind, count] of Object.entries(counts))
    assert.ok(count >= PER_CLASS * 0.95, `${kind}: ${count}`);
});
