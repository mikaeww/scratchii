// Runs a sync round every few seconds while a server is set, never two at once, and reports the state.
import type { Board } from "../model/board.ts";
import { deleteBoard, listBoards, loadSyncMarks, saveBoard, saveSyncMark } from "../storage/local.ts";
import { SyncClient, SyncError } from "./client.ts";
import { readSyncSettings, type SyncSettings } from "./settings.ts";
import { Syncer, type OpenBoard, type SyncStore } from "./syncer.ts";

const INTERVAL_MS = 5000;

export type SyncStatus =
  | { readonly kind: "off" }
  | { readonly kind: "syncing" }
  | { readonly kind: "synced"; readonly at: number }
  | { readonly kind: "offline"; readonly message: string }
  | { readonly kind: "error"; readonly message: string };

export interface SyncLoop {
  restart(settings: SyncSettings | null): void;
  // Remembers a board deleted here so the next round tells the server.
  deleted(id: string): void;
  // Forgets a pending deletion after the user undid it.
  restored(id: string): void;
  onStatus(listener: (status: SyncStatus) => void): void;
}

function browserStore(database: IDBDatabase): SyncStore {
  return {
    boards: async () => (await listBoards(database)).boards,
    save: (board: Board) => saveBoard(database, board),
    remove: (id: string) => deleteBoard(database, id),
    marks: () => loadSyncMarks(database),
    mark: (id, mark) => saveSyncMark(database, id, mark),
  };
}

export function startSync(
  database: IDBDatabase,
  open: OpenBoard,
  beforeRound: () => Promise<void>,
): SyncLoop {
  const store = browserStore(database);
  const listeners = new Set<(status: SyncStatus) => void>();
  let settings = readSyncSettings();
  let timer: ReturnType<typeof setTimeout> | null = null;
  let running = false;
  const report = (status: SyncStatus): void => {
    for (const listener of listeners) listener(status);
  };
  const schedule = (delay: number): void => {
    if (timer !== null) clearTimeout(timer);
    timer = settings === null ? null : setTimeout(() => void round(), delay);
  };
  const round = async (): Promise<void> => {
    if (settings === null || running) return;
    running = true;
    report({ kind: "syncing" });
    try {
      // The open board's last edits must be in the database before they can be pushed.
      await beforeRound();
      await new Syncer(new SyncClient(settings.url, settings.token), store, open).round();
      report({ kind: "synced", at: Date.now() });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      report(
        error instanceof SyncError && error.status === 0
          ? { kind: "offline", message }
          : { kind: "error", message },
      );
    } finally {
      running = false;
      schedule(INTERVAL_MS);
    }
  };
  return {
    restart(next) {
      settings = next;
      if (next === null) report({ kind: "off" });
      schedule(0);
    },
    deleted(id) {
      if (settings !== null) store.mark(id, { pushed: 0, seen: 0, deleting: true }).catch(console.error);
    },
    restored(id) {
      store.mark(id, null).catch(console.error);
    },
    onStatus(listener) {
      listeners.add(listener);
      listener(settings === null ? { kind: "off" } : { kind: "syncing" });
    },
  };
}
