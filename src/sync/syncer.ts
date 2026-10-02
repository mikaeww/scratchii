// One sync round: pull boards the server changed, push boards changed here, and pass deletions both ways.
// Storage and the open board are reached through small interfaces so tests run it in Node against a real
// server. Rules: docs/verification/sync.md.
import type { Board } from "../model/board.ts";
import { mergeBoards } from "../model/merge.ts";
import type { RemoteEntry, SyncClient } from "./client.ts";

export interface Mark {
  // Local `updated` of the board when it was last pushed or pulled; it changed here when `updated` is larger.
  readonly pushed: number;
  // Server revision last seen for this board.
  readonly seen: number;
  // Deleted here and not yet told to the server.
  readonly deleting: boolean;
}

export interface SyncStore {
  boards(): Promise<Board[]>;
  save(board: Board): Promise<void>;
  remove(id: string): Promise<void>;
  marks(): Promise<Map<string, Mark>>;
  mark(id: string, mark: Mark | null): Promise<void>;
}

export interface OpenBoard {
  readonly id: () => string;
  // Merges into the live board; the session saves it.
  readonly apply: (board: Board) => void;
  readonly removed: () => void;
}

const FRESH: Mark = { pushed: 0, seen: 0, deleting: false };

export class Syncer {
  private readonly client: SyncClient;
  private readonly store: SyncStore;
  private readonly open: OpenBoard;

  constructor(client: SyncClient, store: SyncStore, open: OpenBoard) {
    this.client = client;
    this.store = store;
    this.open = open;
  }

  private async keep(board: Board): Promise<void> {
    if (board.id === this.open.id()) this.open.apply(board);
    else await this.store.save(board);
  }

  private async drop(id: string): Promise<void> {
    await this.store.remove(id);
    if (id === this.open.id()) this.open.removed();
  }

  private async pullOne(entry: RemoteEntry, mark: Mark, local: Map<string, Board>): Promise<void> {
    const mine = local.get(entry.id);
    if (entry.deleted) {
      // Local edits made after the last sync survive a remote deletion: they are pushed and revive the board.
      if (mine !== undefined && mine.updated <= mark.pushed) {
        await this.drop(entry.id);
        local.delete(entry.id);
      }
      await this.store.mark(entry.id, { ...mark, seen: entry.revision });
      return;
    }
    const remote = await this.client.get(entry.id);
    if (remote === null) return;
    const merged = mine === undefined ? remote.board : mergeBoards(mine, remote.board);
    await this.keep(merged);
    local.set(entry.id, merged);
    // A board that only changed remotely counts as pushed; one with local edits still is pushed below.
    const pushed = mine === undefined || mine.updated <= mark.pushed ? merged.updated : mark.pushed;
    await this.store.mark(entry.id, { pushed, seen: remote.revision, deleting: false });
  }

  private async push(local: Map<string, Board>, marks: Map<string, Mark>): Promise<void> {
    for (const board of local.values()) {
      const mark = marks.get(board.id) ?? FRESH;
      if (board.updated <= mark.pushed) continue;
      const stored = await this.client.put(board);
      if (stored === null) {
        await this.drop(board.id);
        await this.store.mark(board.id, null);
        continue;
      }
      await this.keep(stored.board);
      await this.store.mark(board.id, {
        pushed: stored.board.updated,
        seen: stored.revision,
        deleting: false,
      });
    }
  }

  async round(): Promise<void> {
    for (const [id, mark] of await this.store.marks()) {
      if (!mark.deleting) continue;
      await this.client.remove(id);
      await this.store.mark(id, null);
    }
    const local = new Map((await this.store.boards()).map((board) => [board.id, board]));
    const marks = await this.store.marks();
    for (const entry of await this.client.list()) {
      const mark = marks.get(entry.id) ?? FRESH;
      if (!mark.deleting && entry.revision > mark.seen) await this.pullOne(entry, mark, local);
    }
    await this.push(local, await this.store.marks());
  }
}
