// The top-left panel: the board's title (editable), the library and the file menu.
import type { Editor } from "../editor/editor.ts";
import { icon } from "./icons.ts";
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

function fileMenu(actions: FileActions): HTMLElement {
  const menu = document.createElement("div");
  menu.className = "menu file-menu";
  menu.setAttribute("role", "menu");
  menu.hidden = true;
  const entries: [TextKey, () => void][] = [
    ["file.new", actions.create],
    ["file.open", actions.open],
    ["file.save", actions.save],
    ["file.png", actions.exportPng],
    ["file.svg", actions.exportSvg],
    ["file.pdf", actions.exportPdf],
  ];
  for (const [label, run] of entries) {
    const item = document.createElement("button");
    item.className = "menu-item";
    item.setAttribute("role", "menuitem");
    item.textContent = text(label);
    item.addEventListener("click", () => {
      menu.hidden = true;
      run();
    });
    menu.append(item);
  }
  return menu;
}

function iconButton(name: "library" | "file", label: TextKey, action: () => void): HTMLButtonElement {
  const button = document.createElement("button");
  button.className = "button icon";
  button.title = text(label);
  button.setAttribute("aria-label", text(label));
  button.append(icon(name));
  button.addEventListener("click", action);
  return button;
}

export function boardPanel(editor: Editor, actions: FileActions): HTMLElement {
  const panel = document.createElement("div");
  panel.className = "panel top-left";
  const mark = document.createElement("span");
  mark.className = "brand-mark";
  mark.textContent = "S";
  mark.setAttribute("aria-hidden", "true");
  const menu = fileMenu(actions);
  const file = iconButton("file", "board.file", () => {
    menu.hidden = !menu.hidden;
    if (!menu.hidden) menu.querySelector<HTMLElement>("[role=menuitem]")?.focus();
  });
  file.setAttribute("aria-haspopup", "menu");
  document.addEventListener(
    "pointerdown",
    (event) => {
      if (!menu.hidden && !menu.contains(event.target as Node) && event.target !== file) menu.hidden = true;
    },
    true,
  );
  menu.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      menu.hidden = true;
      file.focus();
    }
  });
  panel.append(mark, titleInput(editor), iconButton("library", "board.library", actions.library), file, menu);
  return panel;
}
