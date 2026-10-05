import assert from "node:assert/strict";
import { test } from "node:test";
import { Editor } from "../src/editor/editor.ts";
import { createEraser } from "../src/editor/tools/eraser.ts";
import { createPen } from "../src/editor/tools/pen.ts";
import type { PointerSample } from "../src/editor/tools/tool.ts";
import { createBoard } from "../src/model/board.ts";
import { createItem, updateItem, type Item, type StrokeItem } from "../src/model/item.ts";
import { pick, randomItem, seeded } from "./random.ts";

function content(items: readonly Item[]): unknown[] {
  return items
    .filter((item) => !item.deleted)
    .map(({ version, nonce, updated, ...rest }) => rest)
    .sort((a, b) => a.id.localeCompare(b.id));
}

test("H2: undo and redo restore earlier content as newer versions only", () => {
  const random = seeded(8);
  for (let run = 0; run < 300; run++) {
    const editor = new Editor(createBoard("test"));
    const snapshots = [content(editor.board.items)];
    for (let step = 0; step < 8; step++) {
      const live = editor.board.items.filter((item) => !item.deleted);
      const roll = random();
      if (roll < 0.5 || live.length === 0) editor.commit([randomItem(random)]);
      else if (roll < 0.75) editor.commit([updateItem(pick(random, live), { x: random() })]);
      else editor.commit([updateItem(pick(random, live), { deleted: true })]);
      snapshots.push(content(editor.board.items));
    }
    for (let back = snapshots.length - 2; back >= 0; back--) {
      const before = new Map(editor.board.items.map((item) => [item.id, item]));
      editor.undo();
      assert.deepEqual(content(editor.board.items), snapshots[back], `run ${run} undo to ${back}`);
      for (const item of editor.board.items) {
        const old = before.get(item.id);
        if (old !== undefined && old !== item) assert.ok(item.version > old.version, `run ${run}`);
      }
    }
    editor.redo();
    assert.deepEqual(content(editor.board.items), snapshots[1]);
  }
});

function sample(x: number, y: number): PointerSample {
  return { world: [x, y], screen: [x, y], pressure: 0.5, hasPressure: false, shift: false };
}

test("R7: moving on after a snapped pause keeps drawing freehand", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const editor = new Editor(createBoard("test"));
  const pen = createPen(editor, () => true);
  pen.down(sample(0, 0));
  for (let x = 5; x <= 300; x += 5) pen.move(sample(x, Math.sin(x) * 0.5));
  t.mock.timers.tick(600);
  assert.equal(editor.draft[0]?.type, "line", "the pause snaps the straight stroke to a line");
  for (let y = 5; y <= 150; y += 5) pen.move(sample(300, y));
  pen.up(sample(300, 150));
  const [drawn] = editor.board.items;
  assert.ok(drawn?.type === "stroke" && drawn.points.length > 80, "the whole stroke is kept");
});

test("G6: a fast eraser swipe erases what lies between two samples", () => {
  const strokeAt = (x: number): Item =>
    createItem<StrokeItem>({
      type: "stroke",
      x,
      y: -50,
      color: "ink",
      size: "m",
      points: [
        [0, 0, 0.5],
        [0, 100, 0.5],
      ],
      pressure: false,
      tip: "pen",
    });
  const editor = new Editor(createBoard("test"));
  editor.commit([strokeAt(100), strokeAt(200)]);
  const eraser = createEraser(editor);
  eraser.down(sample(0, 0));
  eraser.move(sample(300, 0));
  eraser.up(sample(300, 0));
  assert.equal(editor.board.items.filter((item) => !item.deleted).length, 0);
});
