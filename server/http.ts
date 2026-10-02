// The sync API and the static app, as one request handler. Every /api request needs the bearer token;
// bodies are size-limited and validated with the app's own model code before anything is stored.
import { createHash, timingSafeEqual } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { ValidationError, validateBoard } from "../src/model/validate.ts";
import { staticFile } from "./files.ts";
import type { BoardStore } from "./store.ts";

export interface ServerOptions {
  readonly store: BoardStore;
  readonly token: string;
  readonly appDir: string;
  // Bytes; pictures make boards large, so this is generous but finite.
  readonly maxBody: number;
}

class HttpError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// Comparing digests keeps the comparison constant-time even when the lengths differ.
function tokenMatches(header: string | undefined, token: string): boolean {
  const given = header?.startsWith("Bearer ") === true ? header.slice(7) : "";
  const digest = (value: string): Buffer => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(given), digest(token));
}

async function readBody(request: IncomingMessage, limit: number): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request as AsyncIterable<Buffer>) {
    size += chunk.length;
    if (size > limit) throw new HttpError(413, `body larger than ${limit} bytes`);
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new HttpError(400, "body is not JSON");
  }
}

function send(response: ServerResponse, status: number, body?: unknown): void {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(body === undefined ? undefined : JSON.stringify(body));
}

async function api(
  request: IncomingMessage,
  response: ServerResponse,
  options: ServerOptions,
  id: string | null,
): Promise<void> {
  const { store } = options;
  if (request.method === "GET" && id === null) {
    send(response, 200, store.list());
    return;
  }
  if (id === null) throw new HttpError(405, "only GET on /api/boards");
  if (request.method === "GET") {
    const found = store.get(id);
    if (found.kind === "live") {
      send(response, 200, { board: found.board, revision: found.revision });
      return;
    }
    throw new HttpError(found.kind === "deleted" ? 410 : 404, `board ${id} is ${found.kind}`);
  }
  if (request.method === "PUT") {
    const board = validateBoard(await readBody(request, options.maxBody), "body");
    if (board.id !== id) throw new HttpError(400, `body.id ${board.id} does not match the URL`);
    const stored = store.put(board);
    if (stored === null) throw new HttpError(410, `board ${id} was deleted after this copy last changed`);
    send(response, 200, stored);
    return;
  }
  if (request.method === "DELETE") {
    store.remove(id);
    send(response, 204);
    return;
  }
  throw new HttpError(405, `${request.method ?? "?"} is not supported`);
}

const API = /^\/api\/boards(?:\/([A-Za-z0-9-]{1,64}))?$/;

export function createHandler(options: ServerOptions) {
  return async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
    const path = new URL(request.url ?? "/", "http://localhost").pathname;
    // The token travels in a header, never a cookie, so allowing every origin does not open CSRF.
    response.setHeader("access-control-allow-origin", "*");
    response.setHeader("access-control-allow-headers", "authorization, content-type");
    response.setHeader("access-control-allow-methods", "GET, PUT, DELETE, OPTIONS");
    try {
      if (request.method === "OPTIONS") {
        send(response, 204);
        return;
      }
      const match = API.exec(path);
      if (match !== null) {
        if (!tokenMatches(request.headers.authorization, options.token))
          throw new HttpError(401, "wrong or missing token");
        await api(request, response, options, match[1] ?? null);
        return;
      }
      if (path.startsWith("/api/")) throw new HttpError(404, "unknown API path");
      const file = request.method === "GET" ? await staticFile(options.appDir, path) : null;
      if (file === null) throw new HttpError(404, "not found");
      response.writeHead(200, { "content-type": file.type });
      response.end(file.body);
    } catch (error) {
      if (error instanceof ValidationError) {
        send(response, 400, { error: error.message });
        return;
      }
      if (error instanceof HttpError) {
        send(response, error.status, { error: error.message });
        return;
      }
      console.error(error);
      send(response, 500, { error: "internal error" });
    }
  };
}
