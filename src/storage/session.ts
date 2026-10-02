// Which board is open, saving it shortly after every change, and switching boards without losing the last
// edits of the one being left. Not here: the database itself (local.ts).
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

export interface SessionHooks {
  readonly onError: (error: unknown) => void;
  // Called after each successful save, e.g. to refresh the library thumbnail.
  readonly onSaved: (board: Board) => void;
}

export class Session {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private pending: Board | null = null;

  private readonly database: IDBDatabase;
  private readonly editor: Editor;
  private readonly hooks: SessionHooks;

  constructor(database: IDBDatabase, editor: Editor, hooks: SessionHooks) {
    this.database = database;
    this.editor = editor;
    this.hooks = hooks;
    editor.on((change) => {
      if (change !== "items" && change !== "meta" && change !== "remote") return;
      this.pending = editor.board;
      if (this.timer !== null) clearTimeout(this.timer);
      this.timer = setTimeout(() => void this.flush(), DELAY_MS);
    });
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") void this.flush();
    });
  }

  async flush(): Promise<void> {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    const board = this.pending;
    this.pending = null;
    if (board === null) return;
    writeLastId(board.id);
    try {
      await saveBoard(this.database, board);
      this.hooks.onSaved(board);
    } catch (error) {
      this.hooks.onError(error);
    }
  }

  // Saves what is pending for the current board first, so switching never drops its last edits.
  async open(board: Board): Promise<void> {
    await this.flush();
    this.editor.load(board);
    this.pending = board;
    await this.flush();
  }
}
