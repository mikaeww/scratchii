import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { createHandler } from "../server/http.ts";
import { BoardStore } from "../server/store.ts";
import { createBoard, nextUpdate, putItems, type Board } from "../src/model/board.ts";
import { updateItem } from "../src/model/item.ts";
import { SyncClient } from "../src/sync/client.ts";
import { Syncer, type Mark, type SyncStore } from "../src/sync/syncer.ts";
import { randomItem, seeded } from "./random.ts";

const TOKEN = "sync-test-token-0123456789";
const scratch = mkdtempSync(join(tmpdir(), "scratchii-sync-"));
let server: Server;
let store: BoardStore;
let base = "";

before(async () => {
  store = new BoardStore(join(scratch, "boards.db"));
  server = createServer(
    (req, res) => void createHandler({ store, token: TOKEN, appDir: scratch, maxBody: 1 << 22 })(req, res),
  );
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(() => {
  server.close();
  store.close();
  rmSync(scratch, { recursive: true });
});

// One device: its boards and marks in memory, with nothing open.
class Device implements SyncStore {
  readonly local = new Map<string, Board>();
  readonly marked = new Map<string, Mark>();
  readonly syncer = new Syncer(new SyncClient(base, TOKEN), this, {
    id: () => "",
    apply: () => undefined,
    removed: () => undefined,
  });
  boards(): Promise<Board[]> {
    return Promise.resolve([...this.local.values()]);
  }
  save(board: Board): Promise<void> {
    this.local.set(board.id, board);
    return Promise.resolve();
  }
  remove(id: string): Promise<void> {
    this.local.delete(id);
    return Promise.resolve();
  }
  marks(): Promise<Map<string, Mark>> {
    return Promise.resolve(new Map(this.marked));
  }
  mark(id: string, mark: Mark | null): Promise<void> {
    if (mark === null) this.marked.delete(id);
    else this.marked.set(id, mark);
    return Promise.resolve();
  }
  deleteBoard(id: string): void {
    this.local.delete(id);
    this.marked.set(id, { pushed: 0, seen: 0, deleting: true });
  }
}

test("S8: two devices editing different items of one board both keep both edits; deletion travels", async () => {
  const random = seeded(70);
  const a = new Device();
  const b = new Device();
  const board = createBoard("shared");
  await a.save(board);
  await a.syncer.round();
  await b.syncer.round();
  assert.ok(b.local.has(board.id), "b received the board");
  const fromA = randomItem(random, "rect");
  const fromB = randomItem(random, "note");
  await a.save(putItems(a.local.get(board.id) ?? board, [fromA]));
  await b.save(putItems(b.local.get(board.id) ?? board, [fromB]));
  await a.syncer.round();
  await b.syncer.round();
  await a.syncer.round();
  for (const device of [a, b]) {
    const ids = new Set(device.local.get(board.id)?.items.map((item) => item.id));
    assert.ok(ids.has(fromA.id) && ids.has(fromB.id), "both edits on both devices");
  }
  const edited = a.local.get(board.id) ?? board;
  await a.save(putItems(edited, [updateItem(fromA, { deleted: true })]));
  await a.syncer.round();
  await b.syncer.round();
  assert.equal(
    b.local.get(board.id)?.items.find((item) => item.id === fromA.id)?.deleted,
    true,
    "item deletion travels",
  );
  a.deleteBoard(board.id);
  await a.syncer.round();
  await b.syncer.round();
  assert.equal(b.local.has(board.id), false, "board deletion travels");
  await a.syncer.round();
  assert.equal(a.local.has(board.id), false, "the deleted board does not come back");
});

test("S8: a quiet round sends nothing new", async () => {
  const a = new Device();
  await a.save(createBoard("quiet"));
  await a.syncer.round();
  await a.syncer.round();
  const before = store.list().find((entry) => entry.id === [...a.local.keys()][0])?.revision;
  await a.syncer.round();
  assert.equal(store.list().find((entry) => entry.id === [...a.local.keys()][0])?.revision, before);
});

test("S8: a board restored after its deletion was synced comes back everywhere", async () => {
  const a = new Device();
  const b = new Device();
  const board = createBoard("restored");
  await a.save(board);
  await a.syncer.round();
  await b.syncer.round();
  const kept = a.local.get(board.id) ?? board;
  a.deleteBoard(board.id);
  await a.syncer.round();
  await b.syncer.round();
  assert.equal(b.local.has(board.id), false);
  await a.save({ ...kept, updated: nextUpdate(kept) });
  await a.mark(board.id, null);
  await a.syncer.round();
  await b.syncer.round();
  assert.equal(a.local.has(board.id), true, "the restored copy stays");
  assert.equal(b.local.has(board.id), true, "and reaches the other device");
});
