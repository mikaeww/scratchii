import assert from "node:assert/strict";
import { test } from "node:test";
import { putItems } from "../src/model/board.ts";
import { updateItem } from "../src/model/item.ts";
import { ValidationError, validateBoard } from "../src/model/validate.ts";
import { pick, randomBoard, randomItem, seeded } from "./random.ts";

test("M1: every generated board survives JSON and validation unchanged", () => {
  const random = seeded(1);
  for (let i = 0; i < 500; i++) {
    const board = randomBoard(random);
    assert.deepStrictEqual(validateBoard(JSON.parse(JSON.stringify(board))), board, `case ${i}`);
  }
});

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

function* leaves(value: Json, path: string): Generator<string> {
  yield path;
  if (Array.isArray(value)) {
    for (const [index, entry] of value.entries()) yield* leaves(entry, `${path}[${index}]`);
  } else if (typeof value === "object" && value !== null) {
    for (const [key, entry] of Object.entries(value)) yield* leaves(entry, `${path}.${key}`);
  }
}

function replaceAt(root: Json, path: string, replace: (old: Json) => Json): Json {
  const copy = structuredClone(root);
  const steps = [...path.matchAll(/\.(\w+)|\[(\d+)\]/g)].map((m) => m[1] ?? Number(m[2]));
  const last = steps.pop();
  let parent = copy as Record<string | number, Json>;
  for (const step of steps) parent = parent[step] as Record<string | number, Json>;
  if (last === undefined) throw new Error("invariant: mutations never replace the root");
  parent[last] = replace(parent[last] ?? null);
  return copy;
}

function rejectedAt(value: Json): string {
  try {
    validateBoard(value);
  } catch (error) {
    if (error instanceof ValidationError) return error.path;
    throw error;
  }
  return "accepted";
}

test("M2: a wrong type at any path, or an unknown field, is rejected at that path", (t) => {
  const random = seeded(2);
  let board = randomBoard(random);
  while (board.items.length === 0) board = randomBoard(random);
  const json = JSON.parse(JSON.stringify({ ...board, items: board.items.slice(0, 1), tags: ["x"] })) as Json;
  let checked = 0;
  for (const path of [...leaves(json, "board")].slice(1)) {
    // A string replaces anything but strings and null: a line end may hold null or any id string.
    const wrong = replaceAt(json, path, (old) => (typeof old === "string" || old === null ? 1 : "wrong"));
    assert.equal(rejectedAt(wrong), path);
    checked++;
  }
  const withExtra = (fields: Json): Json => ({ ...(fields as object), extra: 1 });
  assert.equal(rejectedAt(withExtra(json)), "board.extra");
  assert.equal(rejectedAt(replaceAt(json, "board.items[0]", withExtra)), "board.items[0].extra");
  assert.ok(checked > 20, `only ${checked} paths checked`);
  t.diagnostic(`M2 paths: ${checked}`);
});

test("M3: updating one item bumps its version and keeps every other item identical", () => {
  const random = seeded(3);
  for (let i = 0; i < 200; i++) {
    const board = putItems(randomBoard(random), [randomItem(random)]);
    const target = pick(random, board.items);
    const changed = updateItem(target, { x: target.x + 1 });
    const next = putItems(board, [changed]);
    assert.equal(changed.version, target.version + 1);
    assert.notEqual(changed.nonce, target.nonce);
    assert.equal(next.items.length, board.items.length);
    for (const [index, item] of next.items.entries()) {
      if (item.id === target.id) assert.equal(item, changed);
      else assert.equal(item, board.items[index]);
    }
  }
});
