// Boards on the server, in one SQLite file. Every write gets the next server revision, which clients use to
// see what changed; clocks on different devices never have to agree. Deleted boards keep a tombstone so other
// devices learn about the deletion. Not here: HTTP or merging rules (src/model/merge.ts).
import { DatabaseSync } from "node:sqlite";
import type { Board } from "../src/model/board.ts";
import { mergeBoards } from "../src/model/merge.ts";
import { validateBoard } from "../src/model/validate.ts";

export interface Entry {
  readonly id: string;
  readonly revision: number;
  readonly deleted: boolean;
}

export type Stored =
  | { readonly kind: "live"; readonly board: Board; readonly revision: number }
  | { readonly kind: "deleted" }
  | { readonly kind: "missing" };

interface Row {
  id: string;
  revision: number;
  updated: number;
  deleted: number;
  data: string | null;
}

export class BoardStore {
  private readonly db: DatabaseSync;

  constructor(path: string) {
    this.db = new DatabaseSync(path);
    this.db.exec(`create table if not exists boards (
      id text primary key, revision integer not null, updated integer not null, deleted integer not null, data text)`);
  }

  private nextRevision(): number {
    const row = this.db
      .prepare("select coalesce(max(revision), 0) + 1 as next from boards")
      .get() as unknown as { next: number };
    return row.next;
  }

  private write(id: string, updated: number, board: Board | null): number {
    const revision = this.nextRevision();
    this.db
      .prepare(
        `insert into boards (id, revision, updated, deleted, data) values (?, ?, ?, ?, ?) on conflict(id) do update
         set revision = excluded.revision, updated = excluded.updated, deleted = excluded.deleted, data = excluded.data`,
      )
      .run(id, revision, updated, board === null ? 1 : 0, board === null ? null : JSON.stringify(board));
    return revision;
  }

  list(): Entry[] {
    const rows = this.db
      .prepare("select id, revision, deleted from boards order by revision")
      .all() as unknown as Row[];
    return rows.map((row) => ({ id: row.id, revision: row.revision, deleted: row.deleted === 1 }));
  }

  get(id: string): Stored {
    const row = this.db.prepare("select * from boards where id = ?").get(id) as unknown as Row | undefined;
    if (row === undefined) return { kind: "missing" };
    if (row.deleted === 1 || row.data === null) return { kind: "deleted" };
    // Stored data was validated on the way in; validating again guards against a hand-edited database file.
    return {
      kind: "live",
      board: validateBoard(JSON.parse(row.data), `stored ${id}`),
      revision: row.revision,
    };
  }

  // Merges an incoming board with the stored one and keeps the result. A board deleted earlier comes back
  // only if the incoming copy was changed after the deletion, so offline edits are never thrown away silently.
  put(incoming: Board): { board: Board; revision: number } | null {
    const stored = this.db
      .prepare("select updated, deleted from boards where id = ?")
      .get(incoming.id) as unknown as Row | undefined;
    if (stored?.deleted === 1 && incoming.updated <= stored.updated) return null;
    const current = this.get(incoming.id);
    const board = current.kind === "live" ? mergeBoards(current.board, incoming) : incoming;
    if (current.kind === "live" && JSON.stringify(board) === JSON.stringify(current.board)) {
      return { board, revision: current.revision };
    }
    return { board, revision: this.write(board.id, board.updated, board) };
  }

  // The tombstone keeps the board's own last `updated`, not the server's clock: a copy edited after that
  // version (same clock domain, it only ever grows) revives the board instead of being refused.
  remove(id: string): void {
    const row = this.db.prepare("select updated from boards where id = ?").get(id) as unknown as
      Row | undefined;
    this.write(id, row?.updated ?? 0, null);
  }

  close(): void {
    this.db.close();
  }
}
