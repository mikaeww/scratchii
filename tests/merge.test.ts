import assert from "node:assert/strict";
import { test } from "node:test";
import { createBoard, type Board } from "../src/model/board.ts";
import { createItem, type Item, type StrokeItem } from "../src/model/item.ts";
import { mergeBoards } from "../src/model/merge.ts";
import { randomBoard, seeded } from "./random.ts";

const IDS = ["a", "b"];

function item(id: string, version: number, nonce: number, deleted: boolean): Item {
  const base = createItem<StrokeItem>({
    type: "stroke",
    x: 0,
    y: 0,
    color: "ink",
    size: "m",
    points: [[0, 0, 0.5]],
    pressure: false,
    tip: "pen",
  });
  return { ...base, id, version, nonce, deleted, seed: version * 10 + nonce, updated: 0 };
}

// Every variant of one item slot: absent, or present with version, nonce and deletion.
function variants(id: string, versions: number[], nonces: number[], deletions: boolean[]): (Item | null)[] {
  const out: (Item | null)[] = [null];
  for (const v of versions) for (const n of nonces) for (const d of deletions) out.push(item(id, v, n, d));
  return out;
}

function boards(versions: number[], nonces: number[], deletions: boolean[]): Board[] {
  const template = { ...createBoard("t"), id: "board" };
  const [first = [], second = []] = IDS.map((id) => variants(id, versions, nonces, deletions));
  const out: Board[] = [];
  for (const [i, x] of first.entries()) {
    for (const [j, y] of second.entries()) {
      const meta = (i + j) % 3;
      out.push({
        ...template,
        title: `title ${meta}`,
        tags: (i * j) % 2 === 0 ? [] : ["x"],
        metaUpdated: meta,
        updated: i + j,
        items: [x, y].filter((v): v is Item => v !== null),
      });
    }
  }
  return out;
}

function shape(board: Board): unknown {
  const items = Object.fromEntries(
    board.items.map((i) => [i.id, `${i.version}/${i.nonce}/${String(i.deleted)}`]),
  );
  return {
    items,
    title: board.title,
    tags: board.tags,
    updated: board.updated,
    metaUpdated: board.metaUpdated,
  };
}

const SPACE = boards([1, 2], [1, 2], [false, true]);

test("S1 + S3 + S4: merge is commutative, idempotent and keeps the newest version of every item", (t) => {
  let pairs = 0;
  for (const a of SPACE) {
    assert.deepEqual(shape(mergeBoards(a, a)), shape(a));
    for (const b of SPACE) {
      const ab = mergeBoards(a, b);
      assert.deepEqual(shape(ab), shape(mergeBoards(b, a)));
      for (const id of IDS) {
        const inputs = [...a.items, ...b.items].filter((i) => i.id === id);
        const merged = ab.items.find((i) => i.id === id);
        if (inputs.length === 0) assert.equal(merged, undefined);
        else {
          assert.ok(merged !== undefined && inputs.includes(merged));
          assert.equal(merged.version, Math.max(...inputs.map((i) => i.version)));
        }
      }
      pairs++;
    }
  }
  t.diagnostic(`S1/S4 pairs: ${pairs}`);
});

test("S2: merge is associative", (t) => {
  const space = boards([1, 2], [1, 2], [false]);
  let triples = 0;
  for (const a of space) {
    for (const b of space) {
      for (const c of space) {
        assert.deepEqual(shape(mergeBoards(mergeBoards(a, b), c)), shape(mergeBoards(a, mergeBoards(b, c))));
        triples++;
      }
    }
  }
  t.diagnostic(`S2 triples: ${triples}`);
});

test("S4: random board pairs lose no edit", () => {
  const random = seeded(50);
  for (let i = 0; i < 2000; i++) {
    const a = randomBoard(random);
    const b = {
      ...randomBoard(random),
      id: a.id,
      items: [
        ...a.items.slice(0, 2).map((x) => ({ ...x, version: x.version + 1 })),
        ...randomBoard(random).items,
      ],
    };
    const merged = new Map(mergeBoards(a, b).items.map((x) => [x.id, x]));
    for (const x of [...a.items, ...b.items])
      assert.ok((merged.get(x.id)?.version ?? -1) >= x.version, `case ${i}`);
  }
});
