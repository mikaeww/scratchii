// The library dialog: every board as a card with thumbnail, title, tags and age; search, open, delete.
import { nextUpdate, type Board } from "../../model/board.ts";
import { deleteBoard, listBoards, loadThumbnail, saveBoard, saveThumbnail } from "../../storage/local.ts";
import { parseTags, search, summarise, type Summary } from "../../storage/library.ts";
import { icon } from "../icons.ts";
import { text } from "../text.ts";
import { showToast } from "../toast.ts";

export interface LibraryHooks {
  readonly currentId: () => string;
  readonly open: (board: Board) => void;
  readonly create: () => void;
  // The open board's tags go through the editor, or the next autosave would overwrite them.
  readonly retagCurrent: (tags: string[]) => void;
  // Sync needs to hear about deletions made here, and about undoing them.
  readonly deleted: (id: string) => void;
  readonly restored: (id: string) => void;
  readonly onError: (error: unknown) => void;
}

const dates = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });

function card(summary: Summary, board: Board, thumbnail: string | null, actions: CardActions): HTMLElement {
  const element = document.createElement("article");
  element.className = "board-card";
  const open = document.createElement("button");
  open.className = "board-open";
  open.setAttribute("aria-label", board.title);
  const preview = document.createElement(thumbnail === null ? "div" : "img");
  preview.className = "board-thumb";
  if (preview instanceof HTMLImageElement && thumbnail !== null) {
    preview.src = thumbnail;
    preview.alt = "";
  }
  const title = document.createElement("span");
  title.className = "board-name";
  title.textContent = summary.title;
  const age = document.createElement("span");
  age.className = "board-age";
  age.textContent = `${text("library.updated")} ${dates.format(summary.updated)}`;
  open.append(preview, title, age);
  open.addEventListener("click", () => {
    actions.open(board);
  });
  const tags = document.createElement("input");
  tags.className = "board-tags";
  tags.value = summary.tags.join(", ");
  tags.placeholder = text("library.tags");
  tags.setAttribute("aria-label", text("library.tags"));
  tags.addEventListener("change", () => {
    actions.retag(board, parseTags(tags.value));
  });
  const remove = document.createElement("button");
  remove.className = "button icon";
  remove.append(icon("trash"));
  const isOpen = actions.isOpen(board);
  remove.disabled = isOpen;
  remove.title = text(isOpen ? "library.deleteOpen" : "library.delete");
  remove.setAttribute("aria-label", remove.title);
  remove.addEventListener("click", () => {
    actions.remove(board, thumbnail);
  });
  const footer = document.createElement("div");
  footer.className = "board-footer";
  footer.append(tags, remove);
  element.append(open, footer);
  return element;
}

interface CardActions {
  readonly open: (board: Board) => void;
  readonly isOpen: (board: Board) => boolean;
  readonly retag: (board: Board, tags: string[]) => void;
  readonly remove: (board: Board, thumbnail: string | null) => void;
}

interface Shell {
  readonly dialog: HTMLDialogElement;
  readonly query: HTMLInputElement;
  readonly create: HTMLButtonElement;
  readonly close: HTMLButtonElement;
  readonly grid: HTMLElement;
  readonly note: HTMLElement;
}

function button(label: string, className: string): HTMLButtonElement {
  const element = document.createElement("button");
  element.className = className;
  element.textContent = label;
  return element;
}

function shell(): Shell {
  const dialog = document.createElement("dialog");
  dialog.className = "dialog library";
  const header = document.createElement("div");
  header.className = "library-header";
  const title = document.createElement("h2");
  title.className = "dialog-title";
  title.textContent = text("library.title");
  const query = document.createElement("input");
  query.type = "search";
  query.className = "input";
  query.placeholder = text("library.search");
  query.setAttribute("aria-label", text("library.search"));
  const create = button(text("file.new"), "button primary");
  const close = button(text("library.close"), "button");
  header.append(title, query, create, close);
  const grid = document.createElement("div");
  grid.className = "board-grid";
  const note = document.createElement("p");
  note.className = "dialog-hint";
  dialog.append(header, note, grid);
  document.body.append(dialog);
  return { dialog, query, create, close, grid, note };
}

function cardActions(
  database: IDBDatabase,
  hooks: LibraryHooks,
  view: Shell,
  refresh: () => void,
): CardActions {
  return {
    open: (board) => {
      view.dialog.close();
      hooks.open(board);
    },
    isOpen: (board) => board.id === hooks.currentId(),
    retag: (board, tags) => {
      if (board.id === hooks.currentId()) hooks.retagCurrent(tags);
      else
        saveBoard(database, { ...board, tags, updated: Date.now(), metaUpdated: Date.now() }).then(
          refresh,
          hooks.onError,
        );
    },
    remove: (board, thumbnail) => {
      deleteBoard(database, board.id).then(refresh, hooks.onError);
      hooks.deleted(board.id);
      showToast(text("library.deleted"), "note", {
        label: text("toast.undo"),
        run: () => {
          // A newer `updated` lets the restored copy revive the board if sync already reported the deletion.
          saveBoard(database, { ...board, updated: nextUpdate(board) })
            .then(() => (thumbnail === null ? undefined : saveThumbnail(database, board.id, thumbnail)))
            .then(() => {
              hooks.restored(board.id);
              refresh();
            }, hooks.onError);
        },
      });
    },
  };
}

export function mountLibrary(database: IDBDatabase, hooks: LibraryHooks): () => void {
  const view = shell();
  let boards: Board[] = [];
  const thumbnails = new Map<string, string | null>();
  const render = (): void => {
    const byId = new Map(boards.map((board) => [board.id, board]));
    const found = search(boards.map(summarise), view.query.value);
    view.grid.replaceChildren(
      ...found.flatMap((summary) => {
        const board = byId.get(summary.id);
        return board === undefined ? [] : [card(summary, board, thumbnails.get(summary.id) ?? null, actions)];
      }),
    );
    if (found.length === 0) view.grid.textContent = text("library.empty");
  };
  const refresh = async (): Promise<void> => {
    const listed = await listBoards(database);
    boards = listed.boards;
    view.note.textContent = `${listed.broken.length} ${text("library.broken")}`;
    view.note.hidden = listed.broken.length === 0;
    for (const board of boards) thumbnails.set(board.id, await loadThumbnail(database, board.id));
    render();
  };
  const actions = cardActions(database, hooks, view, () => void refresh().catch(hooks.onError));
  view.query.addEventListener("input", render);
  view.create.addEventListener("click", () => {
    view.dialog.close();
    hooks.create();
  });
  view.close.addEventListener("click", () => {
    view.dialog.close();
  });
  return () => {
    view.query.value = "";
    view.dialog.showModal();
    refresh().catch(hooks.onError);
  };
}
