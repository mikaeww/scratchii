// Boards in the browser's IndexedDB. Every read goes through validateBoard, because the database outlives the
// code that wrote it. Not here: files on disk (desktop) or sync.
import type { Board } from "../model/board.ts";
import { validateBoard } from "../model/validate.ts";

const DATABASE = "scratchii";
const STORE = "boards";

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
  const request = indexedDB.open(DATABASE, 1);
  request.onupgradeneeded = () => {
    request.result.createObjectStore(STORE, { keyPath: "id" });
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
