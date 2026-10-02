// The right-click menu: marks for text, and the usual actions for any item. Keyboard: arrows move, Escape closes.
import { loadOwnMarks } from "../../annotate/custom.ts";
import { PRESETS, markColor, type Preset } from "../../annotate/presets.ts";
import { deleteSelected, duplicateSelected, restack, selectAll } from "../../editor/commands.ts";
import type { Editor } from "../../editor/editor.ts";
import { screenToWorld } from "../../editor/viewport.ts";
import { itemAt } from "../../geometry/hit.ts";
import { updateItem, type Item, type StrokeItem, type TextItem } from "../../model/item.ts";
import type { Ink } from "../../render/ink.ts";
import { text, type TextKey } from "../text.ts";
import { attachMenuKeys } from "./menu-keys.ts";
import { markFor, markPreview } from "./preview.ts";

const REACH = 6;

type OpenPad = (target: TextItem) => void;

function entry(label: TextKey, action: () => void): HTMLButtonElement {
  const button = document.createElement("button");
  button.className = "menu-item";
  button.setAttribute("role", "menuitem");
  button.textContent = text(label);
  button.addEventListener("click", action);
  return button;
}

function markGrid(editor: Editor, target: TextItem, ink: Ink, done: () => void): HTMLElement {
  const grid = document.createElement("div");
  grid.className = "mark-grid";
  const presets: [Preset, TextKey][] = [
    ...PRESETS.map((preset) => [preset, `mark.${preset.id}` as TextKey] as [Preset, TextKey]),
    ...loadOwnMarks().map((preset) => [preset, "mark.own"] as [Preset, TextKey]),
  ];
  for (const [preset, label] of presets) {
    const color = markColor(editor.style.color, preset.layer);
    const button = document.createElement("button");
    button.className = "mark-option";
    button.setAttribute("role", "menuitem");
    button.setAttribute("aria-label", text(label));
    button.title = text(label);
    button.append(markPreview(preset, color, ink));
    button.addEventListener("click", () => {
      editor.commit([markFor(preset, target.id, color, editor.style.size)]);
      done();
    });
    grid.append(button);
  }
  return grid;
}

function textEntries(
  editor: Editor,
  target: TextItem,
  ink: Ink,
  pad: OpenPad,
  done: () => void,
): HTMLElement[] {
  const heading = document.createElement("span");
  heading.className = "label";
  heading.textContent = text("menu.marks");
  const marks = editor.board.items.filter(
    (item) => item.type === "mark" && !item.deleted && item.target === target.id,
  );
  const entries = [
    heading,
    markGrid(editor, target, ink, done),
    entry("menu.ownMark", () => {
      done();
      pad(target);
    }),
  ];
  if (marks.length > 0) {
    entries.push(
      entry("menu.removeMarks", () => {
        editor.commit(marks.map((mark) => updateItem(mark, { deleted: true })));
        done();
      }),
    );
  }
  return [...entries, divider()];
}

function divider(): HTMLElement {
  const line = document.createElement("hr");
  line.className = "menu-divider";
  return line;
}

function itemEntries(editor: Editor, done: () => void): HTMLElement[] {
  const run = (action: () => void) => () => {
    action();
    done();
  };
  return [
    entry(
      "menu.duplicate",
      run(() => {
        duplicateSelected(editor);
      }),
    ),
    entry(
      "menu.front",
      run(() => {
        restack(editor, true);
      }),
    ),
    entry(
      "menu.back",
      run(() => {
        restack(editor, false);
      }),
    ),
    entry(
      "menu.delete",
      run(() => {
        deleteSelected(editor);
      }),
    ),
  ];
}

export interface MenuDialogs {
  readonly pad: OpenPad;
  readonly toText: (strokes: readonly StrokeItem[]) => void;
}

function entriesFor(
  editor: Editor,
  hit: Item | null,
  ink: Ink,
  dialogs: MenuDialogs,
  close: () => void,
): HTMLElement[] {
  if (hit === null) {
    return [
      entry("menu.selectAll", () => {
        selectAll(editor);
        close();
      }),
    ];
  }
  const handwriting = editor
    .selected()
    .filter((item): item is StrokeItem => item.type === "stroke" && item.tip === "pen");
  const toText =
    handwriting.length === 0
      ? []
      : [
          entry("menu.toText", () => {
            close();
            dialogs.toText(handwriting);
          }),
        ];
  const forText = hit.type === "text" ? textEntries(editor, hit, ink, dialogs.pad, close) : [];
  return [...forText, ...toText, ...itemEntries(editor, close)];
}

export function mountContextMenu(
  canvas: HTMLCanvasElement,
  editor: Editor,
  ink: Ink,
  dialogs: MenuDialogs,
): void {
  const menu = document.createElement("div");
  menu.className = "menu";
  menu.setAttribute("role", "menu");
  menu.setAttribute("aria-label", text("menu.label"));
  menu.hidden = true;
  document.body.append(menu);
  const close = (): void => {
    menu.hidden = true;
    menu.replaceChildren();
  };
  canvas.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    const box = canvas.getBoundingClientRect();
    const world = screenToWorld(editor.view, [event.clientX - box.left, event.clientY - box.top]);
    const hit = itemAt(editor.scene(), world, REACH / editor.view.zoom);
    // Right-clicking inside a selection keeps it, so several strokes can be converted at once.
    if (hit !== null && !editor.selection.has(hit.id)) editor.setSelection([hit.id]);
    menu.replaceChildren(...entriesFor(editor, hit, ink, dialogs, close));
    menu.hidden = false;
    const left = Math.min(event.clientX, window.innerWidth - menu.offsetWidth - 8);
    const top = Math.min(event.clientY, window.innerHeight - menu.offsetHeight - 8);
    menu.style.left = `${Math.max(8, left)}px`;
    menu.style.top = `${Math.max(8, top)}px`;
    menu.querySelector<HTMLElement>("[role=menuitem]")?.focus();
  });
  document.addEventListener(
    "pointerdown",
    (event) => {
      if (!menu.hidden && !menu.contains(event.target as Node)) close();
    },
    true,
  );
  attachMenuKeys(menu, close);
  window.addEventListener("blur", close);
}
