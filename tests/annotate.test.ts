import assert from "node:assert/strict";
import { test } from "node:test";
import { normaliseStrokes } from "../src/annotate/custom.ts";
import { WOBBLE, layOutMark } from "../src/annotate/layout.ts";
import { PRESETS } from "../src/annotate/presets.ts";
import { Editor } from "../src/editor/editor.ts";
import type { Box } from "../src/geometry/box.ts";
import { createBoard } from "../src/model/board.ts";
import { updateItem, type MarkItem } from "../src/model/item.ts";
import { between, pick, randomItem, randomMark, seeded, type Random } from "./random.ts";

function randomLines(random: Random, count: number): Box[] {
  const x = between(random, -1e4, 1e4);
  const y = between(random, -1e4, 1e4);
  const h = between(random, 8, 120);
  return Array.from({ length: count }, (_, i) => ({
    x,
    y: y + i * h,
    width: between(random, 0, 1500),
    height: h,
  }));
}

function withPreset(mark: MarkItem, id: string): MarkItem {
  const preset = PRESETS.find((p) => p.id === id);
  if (preset === undefined) throw new Error(`no preset ${id}`);
  return { ...mark, layer: preset.layer, fit: preset.fit, strokes: preset.strokes, lines: null };
}

test("A1: stretched marks follow the affine line map within the wobble", () => {
  const random = seeded(20);
  const stretched = PRESETS.filter((p) => p.fit === "stretch");
  for (let i = 0; i < 2000; i++) {
    const preset = pick(random, stretched);
    const mark = withPreset(randomMark(random, "t"), preset.id);
    const lines = randomLines(random, 1);
    const [line] = lines;
    if (line === undefined || line.width === 0) continue;
    const laid = layOutMark(mark, lines);
    for (const [s, stroke] of preset.strokes.entries()) {
      for (const [k, [u, v]] of stroke.points.entries()) {
        const point = laid[s]?.points[k];
        assert.ok(point !== undefined);
        const limit: number = WOBBLE * line.height + 1e-9;
        assert.ok(Math.abs(point[0] - (line.x + u * line.width)) <= limit, `case ${i} ${preset.id}`);
        assert.ok(Math.abs(point[1] - (line.y + v * line.height)) <= limit, `case ${i} ${preset.id}`);
      }
    }
  }
});

test("A2: repeated marks stay inside the line and reach its end", () => {
  const random = seeded(21);
  for (const preset of PRESETS.filter((p) => p.fit === "repeat")) {
    for (let i = 0; i < 2000; i++) {
      const mark = withPreset(randomMark(random, "t"), preset.id);
      const lines = randomLines(random, 1);
      const [line] = lines;
      if (line === undefined || line.width === 0) continue;
      const xs = layOutMark(mark, lines).flatMap((stroke) => stroke.points.map(([x]) => x));
      const right = line.x + line.width;
      assert.ok(Math.max(...xs) <= right + WOBBLE * line.height + 1e-9, `${preset.id} case ${i} overshoots`);
      assert.ok(Math.max(...xs) >= right - line.height - 1e-9, `${preset.id} case ${i} stops short`);
    }
  }
});

test("A3: moving the text moves every mark point by the same amount", () => {
  const random = seeded(22);
  for (let i = 0; i < 2000; i++) {
    const mark = randomMark(random, "t");
    const lines = randomLines(random, 4);
    const dx = between(random, -500, 500);
    const dy = between(random, -500, 500);
    const moved = lines.map((line) => ({ ...line, x: line.x + dx, y: line.y + dy }));
    const before = layOutMark(mark, lines);
    const after = layOutMark(mark, moved);
    for (const [s, stroke] of before.entries()) {
      for (const [k, [x, y]] of stroke.points.entries()) {
        const [ax, ay] = after[s]?.points[k] ?? [NaN, NaN];
        assert.ok(Math.abs(ax - x - dx) < 1e-6 && Math.abs(ay - y - dy) < 1e-6, `case ${i}`);
      }
    }
  }
});

test("A4: deleting a text deletes its marks in the same undo step", () => {
  const random = seeded(23);
  for (let run = 0; run < 300; run++) {
    const editor = new Editor(createBoard("test"));
    const text = randomItem(random, "text");
    const marks = Array.from({ length: 1 + Math.floor(random() * 4) }, () => randomMark(random, text.id));
    const other = randomMark(random, "someone-else");
    editor.commit([text, ...marks, other]);
    editor.commit([updateItem(text, { deleted: true })]);
    const live = editor.scene().map((item) => item.id);
    assert.deepEqual(live, [other.id], `run ${run}`);
    editor.undo();
    assert.equal(editor.scene().length, marks.length + 2, `run ${run}`);
  }
});

test("A5: own strokes laid out on the guide box come back where they were drawn", () => {
  const random = seeded(24);
  for (let i = 0; i < 1000; i++) {
    const guide = {
      x: between(random, 0, 400),
      y: between(random, 0, 200),
      width: between(random, 50, 400),
      height: between(random, 20, 80),
    };
    const drawn = Array.from({ length: 1 + Math.floor(random() * 3) }, () =>
      Array.from(
        { length: 2 + Math.floor(random() * 20) },
        () => [between(random, 0, 600), between(random, 0, 300)] as const,
      ),
    );
    const mark: MarkItem = {
      ...randomMark(random, "t"),
      fit: "stretch",
      lines: null,
      strokes: normaliseStrokes(drawn, guide),
    };
    const laid = layOutMark(mark, [guide]);
    for (const [s, points] of drawn.entries()) {
      for (const [k, [x, y]] of points.entries()) {
        const [lx, ly] = laid[s]?.points[k] ?? [NaN, NaN];
        const limit = WOBBLE * guide.height + 1e-9;
        assert.ok(Math.abs(lx - x) <= limit && Math.abs(ly - y) <= limit, `case ${i}`);
      }
    }
  }
});
