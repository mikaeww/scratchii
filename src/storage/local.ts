// Boards in the browser's IndexedDB. Every read goes through validateBoard, because the database outlives the
// code that wrote it. Not here: files on disk (desktop) or sync.
import type { Board } from "../model/board.ts";
import { validateBoard } from "../model/validate.ts";

const DATABASE = "scratchii";
const STORE = "boards";
const THUMBNAILS = "thumbnails";
const SYNC = "sync";

export class StorageError extends Error {
  constructor(operation: string, cause: unknown) {
    super(`IndexedDB ${operation} failed: ${cause instanceof Error ? cause.message : String(cause)}`, {
      cause,
    });
    this.name = "StorageError";
  }
}

function settle<T>(request: IDBRequest<T>, operation: string): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => {
      resolve(request.result);
    };
    request.onerror = () => {
      reject(new StorageError(operation, request.error));
    };
  });
}

export async function openBoards(): Promise<IDBDatabase> {
  const request = indexedDB.open(DATABASE, 3);
  request.onupgradeneeded = (event) => {
    if (event.oldVersion < 1) request.result.createObjectStore(STORE, { keyPath: "id" });
    if (event.oldVersion < 2) request.result.createObjectStore(THUMBNAILS);
    if (event.oldVersion < 3) request.result.createObjectStore(SYNC);
  };
  return settle(request, "open");
}

export async function saveBoard(database: IDBDatabase, board: Board): Promise<void> {
  const store = database.transaction(STORE, "readwrite").objectStore(STORE);
  await settle(store.put(board), `save ${board.id}`);
}

// Resolves null when there is no such board; rejects with a ValidationError when the stored data is broken.
export async function loadBoard(database: IDBDatabase, id: string): Promise<Board | null> {
  const store = database.transaction(STORE, "readonly").objectStore(STORE);
  const value: unknown = await settle(store.get(id), `load ${id}`);
  return value === undefined ? null : validateBoard(value, `board ${id}`);
}

// Every stored board that validates, and the ids of those that do not, so the library can say so.
export async function listBoards(database: IDBDatabase): Promise<{ boards: Board[]; broken: string[] }> {
  const store = database.transaction(STORE, "readonly").objectStore(STORE);
  const values: unknown[] = await settle(store.getAll(), "list");
  const boards: Board[] = [];
  const broken: string[] = [];
  for (const value of values) {
    try {
      boards.push(validateBoard(value, "stored board"));
    } catch (error) {
      console.error(error);
      const id = (value as { id?: unknown } | null)?.id;
      broken.push(typeof id === "string" ? id : "?");
    }
  }
  return { boards, broken };
}

export async function deleteBoard(database: IDBDatabase, id: string): Promise<void> {
  const transaction = database.transaction([STORE, THUMBNAILS], "readwrite");
  await settle(transaction.objectStore(STORE).delete(id), `delete ${id}`);
  await settle(transaction.objectStore(THUMBNAILS).delete(id), `delete thumbnail ${id}`);
}

export async function saveThumbnail(database: IDBDatabase, id: string, dataUrl: string): Promise<void> {
  const store = database.transaction(THUMBNAILS, "readwrite").objectStore(THUMBNAILS);
  await settle(store.put(dataUrl, id), `save thumbnail ${id}`);
}

export async function loadThumbnail(database: IDBDatabase, id: string): Promise<string | null> {
  const store = database.transaction(THUMBNAILS, "readonly").objectStore(THUMBNAILS);
  const value: unknown = await settle(store.get(id), `load thumbnail ${id}`);
  return typeof value === "string" && value.startsWith("data:image/png;base64,") ? value : null;
}

export interface SyncMark {
  readonly pushed: number;
  readonly seen: number;
  readonly deleting: boolean;
}

function isMark(value: unknown): value is SyncMark {
  const mark = value as Partial<SyncMark> | null;
  return (
    typeof mark?.pushed === "number" && typeof mark.seen === "number" && typeof mark.deleting === "boolean"
  );
}

export async function loadSyncMarks(database: IDBDatabase): Promise<Map<string, SyncMark>> {
  const store = database.transaction(SYNC, "readonly").objectStore(SYNC);
  const [keys, values] = await Promise.all([
    settle(store.getAllKeys(), "sync keys"),
    settle(store.getAll(), "sync marks"),
  ]);
  const marks = new Map<string, SyncMark>();
  keys.forEach((key, index) => {
    const value: unknown = values[index];
    // A malformed mark only costs one extra upload; it is dropped rather than trusted.
    if (typeof key === "string" && isMark(value)) marks.set(key, value);
  });
  return marks;
}

export async function saveSyncMark(database: IDBDatabase, id: string, mark: SyncMark | null): Promise<void> {
  const store = database.transaction(SYNC, "readwrite").objectStore(SYNC);
  if (mark === null) await settle(store.delete(id), `forget sync mark ${id}`);
  else await settle(store.put(mark, id), `sync mark ${id}`);
}
