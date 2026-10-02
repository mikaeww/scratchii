// What the file menu and the library do: new, open, save, export, switch boards. Storage may be missing
// (private windows); then everything that needs it says so instead of failing silently.
import type { Editor } from "../../editor/editor.ts";
import { createBoard, type Board } from "../../model/board.ts";
import { FILE_EXTENSION, parseFile, serialiseFile } from "../../model/file.ts";
import { exportPdf, exportPng, exportSvg, thumbnail } from "../../render/export/raster.ts";
import type { Ink } from "../../render/ink.ts";
import { chooseFile, downloadFile, fileName } from "../../storage/disk.ts";
import { importAs } from "../../storage/library.ts";
import { listBoards, saveBoard, saveThumbnail } from "../../storage/local.ts";
import { Session } from "../../storage/session.ts";
import type { FileActions } from "../board-panel.ts";
import { text, type TextKey } from "../text.ts";
import { showToast } from "../toast.ts";
import { mountLibrary } from "./library.ts";

// Thumbnails cost a full render; one per few seconds of editing is plenty for the library.
const THUMBNAIL_DELAY_MS = 3000;

function report(prefix: TextKey) {
  return (error: unknown): void => {
    console.error(error);
    showToast(`${text(prefix)} ${error instanceof Error ? error.message : String(error)}`, "error");
  };
}

// One timer per board: switching boards must not cancel the thumbnail of the board just left.
function keepThumbnails(database: IDBDatabase, ink: Ink): (board: Board) => void {
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  return (board) => {
    clearTimeout(timers.get(board.id));
    timers.set(
      board.id,
      setTimeout(() => {
        timers.delete(board.id);
        thumbnail(board.items, ink)
          .then((url) => saveThumbnail(database, board.id, url))
          .catch(report("storage.saveFailed"));
      }, THUMBNAIL_DELAY_MS),
    );
  };
}

type Open = (board: Board) => void;

function fileOpener(database: IDBDatabase | null, open: Open): (file: File) => Promise<void> {
  return async (file) => {
    const board = parseFile(await file.text(), file.name);
    const stored = database === null ? [] : (await listBoards(database)).boards;
    const imported = importAs(board, new Set(stored.map((b) => b.id)));
    if (database !== null) await saveBoard(database, imported);
    open(imported);
    showToast(text("file.opened"), "note");
  };
}

function libraryOpener(
  editor: Editor,
  database: IDBDatabase | null,
  open: Open,
  create: () => void,
): () => void {
  if (database === null) {
    return () => {
      showToast(text("storage.unavailable"), "error");
    };
  }
  return mountLibrary(database, {
    currentId: () => editor.board.id,
    open,
    create,
    retagCurrent: (tags) => {
      editor.updateBoard({ tags });
    },
    onError: report("storage.saveFailed"),
  });
}

export function boardActions(editor: Editor, ink: Ink, database: IDBDatabase | null): FileActions {
  const session =
    database === null
      ? null
      : new Session(database, editor, {
          onError: report("storage.saveFailed"),
          onSaved: keepThumbnails(database, ink),
        });
  const open: Open = (board) => {
    if (session === null) editor.load(board);
    else session.open(board).catch(report("storage.saveFailed"));
  };
  const create = (): void => {
    open(createBoard(text("board.untitled")));
  };
  const openFile = fileOpener(database, open);
  const exporting = (make: () => Promise<Blob>, extension: string) => (): void => {
    make()
      .then((blob) => downloadFile(fileName(editor.board.title, extension), blob))
      .catch(report("file.exportFailed"));
  };
  return {
    create,
    open: () => {
      chooseFile(`${FILE_EXTENSION},application/json`)
        .then((file) => (file === null ? undefined : openFile(file)))
        .catch(report("file.unreadable"));
    },
    openFile: (file) => {
      openFile(file).catch(report("file.unreadable"));
    },
    save: () => {
      const blob = new Blob([serialiseFile(editor.board)], { type: "application/json" });
      downloadFile(fileName(editor.board.title, FILE_EXTENSION), blob).catch(report("file.exportFailed"));
    },
    exportPng: exporting(() => exportPng(editor.board.items, ink), ".png"),
    exportSvg: exporting(() => exportSvg(editor.board.items, ink), ".svg"),
    exportPdf: exporting(() => exportPdf(editor.board.items, ink), ".pdf"),
    library: libraryOpener(editor, database, open, create),
  };
}
