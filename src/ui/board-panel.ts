// The top-left panel: the board's title (editable), the library and the file menu.
import type { Editor } from "../editor/editor.ts";
import { icon } from "./icons.ts";
import type { SyncStatus } from "../sync/loop.ts";
import { attachMenuKeys } from "./menus/menu-keys.ts";
import { text, type TextKey } from "./text.ts";

export interface FileActions {
  readonly create: () => void;
  readonly open: () => void;
  readonly openFile: (file: File) => void;
  readonly save: () => void;
  readonly exportPng: () => void;
  readonly exportSvg: () => void;
  readonly exportPdf: () => void;
  readonly library: () => void;
  readonly settings: () => void;
  readonly onSyncStatus: (listener: (status: SyncStatus) => void) => void;
}

const SYNC_LABEL: Readonly<Record<SyncStatus["kind"], TextKey>> = {
  off: "sync.off",
  syncing: "sync.syncing",
  synced: "sync.synced",
  offline: "sync.offline",
  error: "sync.error",
};

function syncButton(actions: FileActions): HTMLButtonElement {
  const button = document.createElement("button");
  button.className = "button icon sync-status";
  const dot = document.createElement("span");
  dot.className = "sync-dot";
  dot.setAttribute("aria-hidden", "true");
  button.append(icon("cloud"), dot);
  button.addEventListener("click", actions.settings);
  actions.onSyncStatus((status) => {
    const detail = "message" in status ? ` ${status.message}` : "";
    button.title = `${text(SYNC_LABEL[status.kind])}${detail} · ${text("settings.open")}`;
    button.setAttribute("aria-label", button.title);
    button.dataset.state = status.kind;
  });
  return button;
}

function titleInput(editor: Editor): HTMLInputElement {
  const input = document.createElement("input");
  input.className = "board-title";
  input.setAttribute("aria-label", text("board.title"));
  input.spellcheck = false;
  const sync = (): void => {
    if (document.activeElement !== input) input.value = editor.board.title;
  };
  input.addEventListener("change", () => {
    const title = input.value.trim();
    if (title === "") input.value = editor.board.title;
    else editor.updateBoard({ title });
  });
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === "Escape") input.blur();
  });
  editor.on((change) => {
    if (change === "board" || change === "meta") sync();
  });
  sync();
  return input;
}

type Entry = readonly [label: string, run: () => void];

function fileEntries(actions: FileActions): Entry[] {
  const entries: [TextKey, () => void][] = [
    ["file.new", actions.create],
    ["file.open", actions.open],
    ["file.save", actions.save],
    ["file.png", actions.exportPng],
    ["file.svg", actions.exportSvg],
    ["file.pdf", actions.exportPdf],
  ];
  return entries.map(([key, run]) => [text(key), run]);
}

// A button with a menu under it; the entries are read each time it opens. Arrows move, Escape closes.
function menuButton(button: HTMLButtonElement, entries: () => readonly Entry[]): HTMLElement {
  const menu = document.createElement("div");
  menu.className = "menu panel-menu";
  menu.setAttribute("role", "menu");
  menu.hidden = true;
  const fill = (): void => {
    menu.replaceChildren(
      ...entries().map(([label, run]) => {
        const item = document.createElement("button");
        item.className = "menu-item";
        item.setAttribute("role", "menuitem");
        item.textContent = label;
        item.addEventListener("click", () => {
          menu.hidden = true;
          run();
        });
        return item;
      }),
    );
  };
  button.setAttribute("aria-haspopup", "menu");
  button.addEventListener("click", () => {
    if (menu.hidden) fill();
    menu.hidden = !menu.hidden;
    if (!menu.hidden) menu.querySelector<HTMLElement>("[role=menuitem]")?.focus();
  });
  document.addEventListener(
    "pointerdown",
    (event) => {
      const outside = !menu.contains(event.target as Node) && !button.contains(event.target as Node);
      if (!menu.hidden && outside) menu.hidden = true;
    },
    true,
  );
  attachMenuKeys(menu, () => {
    menu.hidden = true;
    button.focus();
  });
  return menu;
}

function iconButton(
  name: "library" | "file" | "cloud" | "command" | "plus",
  label: TextKey,
  action: () => void,
): HTMLButtonElement {
  const button = document.createElement("button");
  button.className = "button icon";
  button.title = text(label);
  button.setAttribute("aria-label", text(label));
  button.append(icon(name));
  button.addEventListener("click", action);
  return button;
}

export interface PanelMenus {
  readonly openPalette: () => void;
  // Everything that puts something new on the board: tables, graphs, diagrams, building blocks, templates, PDF.
  readonly inserts: () => readonly Entry[];
}

export function boardPanel(editor: Editor, actions: FileActions, menus: PanelMenus): HTMLElement {
  const panel = document.createElement("div");
  panel.className = "panel top-left";
  const mark = document.createElement("span");
  mark.className = "brand-mark";
  mark.textContent = "S";
  mark.setAttribute("aria-hidden", "true");
  const insert = iconButton("plus", "board.insert", () => undefined);
  const file = iconButton("file", "board.file", () => undefined);
  panel.append(
    mark,
    titleInput(editor),
    insert,
    menuButton(insert, menus.inserts),
    iconButton("command", "board.palette", menus.openPalette),
    iconButton("library", "board.library", actions.library),
    file,
    menuButton(file, () => fileEntries(actions)),
    syncButton(actions),
  );
  return panel;
}
