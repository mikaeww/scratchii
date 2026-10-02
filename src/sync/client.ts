// Talks to a Scratchii sync server (server/). Every answer that carries a board is validated before use.
import type { Board } from "../model/board.ts";
import { validateBoard } from "../model/validate.ts";

// `revision` is the server's write counter: higher means changed later, whatever the device clocks say.
export interface RemoteEntry {
  readonly id: string;
  readonly revision: number;
  readonly deleted: boolean;
}

export interface RemoteBoard {
  readonly board: Board;
  readonly revision: number;
}

const TIMEOUT_MS = 15_000;

export class SyncError extends Error {
  // 0 when the server could not be reached at all.
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "SyncError";
    this.status = status;
  }
}

function entries(value: unknown): RemoteEntry[] {
  if (!Array.isArray(value)) throw new SyncError(502, "the server sent no board list");
  return value.map((raw: unknown, index) => {
    const entry = raw as Partial<RemoteEntry> | null;
    if (
      typeof entry?.id !== "string" ||
      typeof entry.revision !== "number" ||
      typeof entry.deleted !== "boolean"
    ) {
      throw new SyncError(502, `board list entry ${index} is malformed`);
    }
    return { id: entry.id, revision: entry.revision, deleted: entry.deleted };
  });
}

function remoteBoard(value: unknown): RemoteBoard {
  const answer = value as { board?: unknown; revision?: unknown } | null;
  if (typeof answer?.revision !== "number") throw new SyncError(502, "the server sent no revision");
  return { board: validateBoard(answer.board, "server board"), revision: answer.revision };
}

export class SyncClient {
  private readonly base: string;
  private readonly token: string;

  constructor(base: string, token: string) {
    this.base = base.replace(/\/+$/, "");
    this.token = token;
  }

  private async call(path: string, init: RequestInit = {}): Promise<Response> {
    let response: Response;
    try {
      response = await fetch(`${this.base}/api/boards${path}`, {
        ...init,
        headers: { authorization: `Bearer ${this.token}`, "content-type": "application/json" },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (error) {
      throw new SyncError(
        0,
        `server not reachable (${error instanceof Error ? error.message : String(error)})`,
      );
    }
    if (!response.ok && response.status !== 410) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new SyncError(response.status, body?.error ?? `server answered ${response.status}`);
    }
    return response;
  }

  async list(): Promise<RemoteEntry[]> {
    return entries(await (await this.call("")).json());
  }

  // Null when the server holds only a tombstone for this board.
  async get(id: string): Promise<RemoteBoard | null> {
    const response = await this.call(`/${encodeURIComponent(id)}`);
    return response.status === 410 ? null : remoteBoard(await response.json());
  }

  // Null when the board was deleted on the server after this copy last changed.
  async put(board: Board): Promise<RemoteBoard | null> {
    const body = JSON.stringify(board);
    const response = await this.call(`/${encodeURIComponent(board.id)}`, { method: "PUT", body });
    return response.status === 410 ? null : remoteBoard(await response.json());
  }

  async remove(id: string): Promise<void> {
    await this.call(`/${encodeURIComponent(id)}`, { method: "DELETE" });
  }
}
