// Which board is open between visits, and saving it shortly after every change. Not here: the database itself.
import type { Editor } from "../editor/editor.ts";
import { createBoard, type Board } from "../model/board.ts";
import { ValidationError } from "../model/validate.ts";
import { loadBoard, saveBoard } from "./local.ts";

const LAST_BOARD = "scratchii.lastBoard";
const DELAY_MS = 400;

// localStorage can be missing or throw in private windows; the app then simply starts with a new board.
function readLastId(): string | null {
  try {
    return localStorage.getItem(LAST_BOARD);
  } catch {
    return null;
  }
}

function writeLastId(id: string): void {
  try {
    localStorage.setItem(LAST_BOARD, id);
  } catch {
    // Only the convenience of reopening the same board is lost; the board itself is in IndexedDB.
  }
}

export interface Opened {
  readonly board: Board;
  // Set when the stored board was broken; it stays in the database untouched.
  readonly unreadable: ValidationError | null;
}

export async function openLastBoard(database: IDBDatabase, untitled: string): Promise<Opened> {
  const id = readLastId();
  if (id !== null) {
    try {
      const board = await loadBoard(database, id);
      if (board !== null) return { board, unreadable: null };
    } catch (error) {
      if (!(error instanceof ValidationError)) throw error;
      return { board: createBoard(untitled), unreadable: error };
    }
  }
  return { board: createBoard(untitled), unreadable: null };
}

export function keepSaved(database: IDBDatabase, editor: Editor, onError: (error: unknown) => void): void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const save = (): void => {
    timer = null;
    const board = editor.board;
    writeLastId(board.id);
    saveBoard(database, board).catch(onError);
  };
  editor.on((change) => {
    if (change !== "items" && change !== "board") return;
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(save, DELAY_MS);
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "hidden" || timer === null) return;
    clearTimeout(timer);
    save();
  });
}
