import assert from "node:assert/strict";
import { test } from "node:test";
import { History } from "../src/editor/history.ts";
import { seeded } from "./random.ts";

test("H1: random commit, undo and redo sequences match a naive snapshot model", () => {
  const random = seeded(4);
  for (let run = 0; run < 1000; run++) {
    const limit = 1 + Math.floor(random() * 20);
    const history = new History(0, limit);
    let states = [0];
    let index = 0;
    const length = Math.floor(random() * 300);
    for (let step = 0; step < length; step++) {
      const roll = random();
      if (roll < 0.5) {
        states = [...states.slice(0, index + 1), step + 1].slice(-limit);
        index = states.length - 1;
        history.commit(step + 1);
      } else if (roll < 0.8) {
        index = Math.max(0, index - 1);
        history.undo();
      } else {
        index = Math.min(states.length - 1, index + 1);
        history.redo();
      }
      assert.equal(history.current, states[index], `run ${run} step ${step}`);
      assert.equal(history.canUndo, index > 0);
      assert.equal(history.canRedo, index < states.length - 1);
    }
  }
});
