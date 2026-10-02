import assert from "node:assert/strict";
import { test } from "node:test";
import { Editor } from "../src/editor/editor.ts";
import { createBoard } from "../src/model/board.ts";
import { updateItem, type Item } from "../src/model/item.ts";
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
