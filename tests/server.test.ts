import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createServer, request, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { createHandler } from "../server/http.ts";
import { BoardStore } from "../server/store.ts";
import { createBoard, putItems } from "../src/model/board.ts";
import { randomItem, seeded } from "./random.ts";

const TOKEN = "test-token-0123456789";
const scratch = mkdtempSync(join(tmpdir(), "scratchii-server-"));
const appDir = join(scratch, "app");
const database = join(scratch, "boards.db");
let server: Server;
let store: BoardStore;
let base = "";

before(async () => {
  mkdirSync(appDir);
  writeFileSync(join(appDir, "index.html"), "<p>app</p>");
  writeFileSync(join(scratch, "secret.txt"), "never served");
  store = new BoardStore(database);
  server = createServer(
    (req, res) => void createHandler({ store, token: TOKEN, appDir, maxBody: 4096 })(req, res),
  );
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(() => {
  server.close();
  store.close();
  rmSync(scratch, { recursive: true });
});

async function call(path: string, init: RequestInit = {}, token: string | null = TOKEN): Promise<Response> {
  const headers = new Headers(init.headers);
  if (token !== null) headers.set("authorization", `Bearer ${token}`);
  return fetch(`${base}${path}`, { ...init, headers });
}

// fetch normalises "../" in URLs, so traversal attempts go out as raw request lines.
function raw(path: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const url = new URL(base);
    const req = request({ host: url.hostname, port: url.port, path, method: "GET" }, (res) => {
      let body = "";
      res.on("data", (chunk: Buffer) => (body += chunk.toString()));
      res.on("end", () => {
        resolve({ status: res.statusCode ?? 0, body });
      });
    });
    req.on("error", reject);
    req.end();
  });
}

test("S5: missing or wrong tokens get 401 and change nothing", async () => {
  const before = statSync(database).mtimeMs;
  const board = createBoard("x");
  for (const token of [null, "", "test-token-0123456780", "short"]) {
    assert.equal((await call("/api/boards", {}, token)).status, 401);
    const put = await call(`/api/boards/${board.id}`, { method: "PUT", body: JSON.stringify(board) }, token);
    assert.equal(put.status, 401);
  }
  assert.deepEqual(store.list(), []);
  assert.equal(statSync(database).mtimeMs, before);
});

test("S6: invalid boards, oversized bodies and mismatched ids are refused", async () => {
  const board = createBoard("x");
  const broken = await call(`/api/boards/${board.id}`, {
    method: "PUT",
    body: JSON.stringify({ ...board, title: 5 }),
  });
  assert.equal(broken.status, 400);
  assert.match(((await broken.json()) as { error: string }).error, /body\.title/);
  const big = await call(`/api/boards/${board.id}`, {
    method: "PUT",
    body: JSON.stringify({ ...board, title: "x".repeat(5000) }),
  });
  assert.equal(big.status, 413);
  const other = await call(`/api/boards/${crypto.randomUUID()}`, {
    method: "PUT",
    body: JSON.stringify(board),
  });
  assert.equal(other.status, 400);
  assert.deepEqual(store.list(), []);
});

test("S7: static files never leave the app directory", async () => {
  assert.equal((await call("/", {}, null)).status, 200);
  for (const path of [
    "/../secret.txt",
    "/%2e%2e/secret.txt",
    "/..%2fsecret.txt",
    "//etc/passwd",
    "/%2e%2e%2f%2e%2e%2fetc/passwd",
  ]) {
    const response = await raw(path);
    assert.equal(response.status, 404, path);
    assert.ok(!response.body.includes("never served"), path);
  }
});

test("S8 (server side): concurrent edits to different items both survive; deletion is reported", async () => {
  const random = seeded(60);
  const board = createBoard("shared");
  assert.equal(
    (await call(`/api/boards/${board.id}`, { method: "PUT", body: JSON.stringify(board) })).status,
    200,
  );
  const first = putItems(board, [randomItem(random, "rect")]);
  const second = putItems(board, [randomItem(random, "ellipse")]);
  await call(`/api/boards/${board.id}`, { method: "PUT", body: JSON.stringify(first) });
  const answer = await call(`/api/boards/${board.id}`, { method: "PUT", body: JSON.stringify(second) });
  const merged = ((await answer.json()) as { board: typeof board }).board;
  assert.deepEqual(
    new Set(merged.items.map((i) => i.id)),
    new Set([...first.items, ...second.items].map((i) => i.id)),
  );
  assert.equal((await call(`/api/boards/${board.id}`, { method: "DELETE" })).status, 204);
  assert.equal((await call(`/api/boards/${board.id}`)).status, 410);
  assert.ok(store.list().some((entry) => entry.id === board.id && entry.deleted));
  const stale = await call(`/api/boards/${board.id}`, { method: "PUT", body: JSON.stringify(second) });
  assert.equal(stale.status, 410);
});
