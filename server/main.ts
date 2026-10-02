// Starts the Scratchii sync server. Configuration comes from the environment:
//   SCRATCHII_TOKEN  required, at least 16 characters; clients send it as "Authorization: Bearer <token>"
//   SCRATCHII_HOST   default 127.0.0.1 (set 0.0.0.0 to reach it from other devices)
//   SCRATCHII_PORT   default 8787
//   SCRATCHII_DATA   SQLite file, default ~/.local/share/scratchii-server/boards.db
import { mkdirSync } from "node:fs";
import { createServer } from "node:http";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { createHandler } from "./http.ts";
import { BoardStore } from "./store.ts";

const MIN_TOKEN = 16;
const MAX_BODY = 64 * 1024 * 1024;

const token = process.env.SCRATCHII_TOKEN ?? "";
if (token.length < MIN_TOKEN) {
  console.error(`scratchii-server: set SCRATCHII_TOKEN to a secret of at least ${MIN_TOKEN} characters`);
  process.exit(1);
}
const host = process.env.SCRATCHII_HOST ?? "127.0.0.1";
const port = Number(process.env.SCRATCHII_PORT ?? "8787");
const data = process.env.SCRATCHII_DATA ?? join(homedir(), ".local/share/scratchii-server/boards.db");
mkdirSync(dirname(data), { recursive: true });

const store = new BoardStore(data);
const handler = createHandler({
  store,
  token,
  appDir: join(import.meta.dirname, "..", "dist"),
  maxBody: MAX_BODY,
});
const server = createServer((request, response) => void handler(request, response));
server.listen(port, host, () => {
  console.error(`scratchii-server: http://${host}:${port}, data in ${data}`);
});
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    server.close(() => {
      store.close();
      process.exit(0);
    });
  });
}
