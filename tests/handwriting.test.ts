import assert from "node:assert/strict";
import { test } from "node:test";
import { strokesToText } from "../src/editor/commands.ts";
import { Editor } from "../src/editor/editor.ts";
import { createBoard } from "../src/model/board.ts";
import type { StrokeItem } from "../src/model/item.ts";
import { pick, randomItem, seeded } from "./random.ts";

const measure = (text: string, fontSize: number): { width: number; height: number } => ({
  width: text.length * fontSize * 0.5,
  height: fontSize * 1.3,
});

test("W1: converting replaces exactly the chosen strokes in one undo step", () => {
  const random = seeded(80);
  for (let run = 0; run < 300; run++) {
    const editor = new Editor(createBoard("t"));
    const items = Array.from({ length: 2 + Math.floor(random() * 8) }, () =>
      randomItem(random, pick(random, ["stroke", "rect", "stroke"] as const)),
    );
    editor.commit(items);
    const strokes = items.filter((item): item is StrokeItem => item.type === "stroke" && random() < 0.7);
    if (strokes.length === 0) continue;
    const before = editor
      .scene()
      .map((item) => item.id)
      .sort();
    const text = strokesToText(editor, strokes, random() < 0.5 ? "Hello" : "two\nlines", measure);
    assert.ok(text !== null);
    const after = editor
      .scene()
      .map((item) => item.id)
      .sort();
    const chosen = new Set(strokes.map((stroke) => stroke.id));
    assert.deepEqual(after, [...before.filter((id) => !chosen.has(id)), text.id].sort(), `run ${run}`);
    assert.equal(
      text.x,
      Math.min(...strokes.map((s) => s.x + Math.min(...s.points.map(([x]) => x)))),
      `run ${run}`,
    );
    editor.undo();
    assert.deepEqual(
      editor
        .scene()
        .map((item) => item.id)
        .sort(),
      before,
      `run ${run}`,
    );
  }
});
