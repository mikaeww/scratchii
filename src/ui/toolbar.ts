// The floating chrome around the canvas: brand, tools, undo and redo, zoom. Plain DOM, wired to the editor.
import type { Editor, ToolName } from "../editor/editor.ts";
import { zoomAt } from "../editor/viewport.ts";
import { icon, type IconName } from "./icons.ts";
import { text, type TextKey } from "./text.ts";

const ZOOM_STEP = 1.25;

function panel(place: string): HTMLElement {
  const element = document.createElement("div");
  element.className = `panel ${place}`;
  return element;
}

function iconButton(name: IconName, label: TextKey, action: () => void): HTMLButtonElement {
  const button = document.createElement("button");
  button.className = "button icon";
  button.title = text(label);
  button.setAttribute("aria-label", text(label));
  button.append(icon(name));
  button.addEventListener("click", action);
  return button;
}

function divider(): HTMLElement {
  const element = document.createElement("span");
  element.className = "divider";
  element.setAttribute("aria-hidden", "true");
  return element;
}

function brand(): HTMLElement {
  const element = panel("top-left");
  const mark = document.createElement("span");
  mark.className = "brand-mark";
  mark.textContent = "S";
  mark.setAttribute("aria-hidden", "true");
  const name = document.createElement("span");
  name.className = "brand";
  name.textContent = text("app.name");
  element.append(mark, name);
  return element;
}

const TOOLS: readonly ToolName[] = [
  "select",
  "hand",
  "pen",
  "marker",
  "rect",
  "ellipse",
  "arrow",
  "line",
  "text",
  "note",
  "eraser",
];
// Groups in the bar: moving around, drawing, shapes, words, removing.
const DIVIDE_AFTER = new Set<ToolName>(["hand", "marker", "line", "note"]);

function toolPanel(editor: Editor): HTMLElement {
  const element = panel("top");
  element.setAttribute("role", "toolbar");
  const buttons = TOOLS.map((tool) => {
    const button = iconButton(tool, `tool.${tool}`, () => {
      editor.setTool(tool);
    });
    return [tool, button] as const;
  });
  const sync = (): void => {
    for (const [tool, button] of buttons) button.setAttribute("aria-pressed", String(editor.tool === tool));
  };
  editor.on((change) => {
    if (change === "tool") sync();
  });
  sync();
  for (const [tool, button] of buttons) {
    element.append(button);
    if (DIVIDE_AFTER.has(tool)) element.append(divider());
  }
  return element;
}

function historyPanel(editor: Editor): HTMLElement {
  const element = panel("bottom-left");
  const undo = iconButton("undo", "history.undo", () => {
    editor.undo();
  });
  const redo = iconButton("redo", "history.redo", () => {
    editor.redo();
  });
  const sync = (): void => {
    undo.disabled = !editor.canUndo;
    redo.disabled = !editor.canRedo;
  };
  editor.on((change) => {
    if (change === "items" || change === "board") sync();
  });
  sync();
  element.append(undo, redo);
  return element;
}

function zoomPanel(editor: Editor, canvas: HTMLCanvasElement): HTMLElement {
  const element = panel("bottom-right");
  const centre = (): [number, number] => [canvas.clientWidth / 2, canvas.clientHeight / 2];
  const readout = document.createElement("button");
  readout.className = "button readout";
  readout.title = text("zoom.reset");
  readout.addEventListener("click", () => {
    editor.setView(zoomAt(editor.view, centre(), 1 / editor.view.zoom));
  });
  const out = iconButton("minus", "zoom.out", () => {
    editor.setView(zoomAt(editor.view, centre(), 1 / ZOOM_STEP));
  });
  const into = iconButton("plus", "zoom.in", () => {
    editor.setView(zoomAt(editor.view, centre(), ZOOM_STEP));
  });
  const sync = (): void => {
    readout.textContent = `${Math.round(editor.view.zoom * 100)} %`;
  };
  editor.on((change) => {
    if (change === "view") sync();
  });
  sync();
  element.append(out, readout, into);
  return element;
}

export function mountChrome(root: HTMLElement, editor: Editor, canvas: HTMLCanvasElement): void {
  root.append(brand(), toolPanel(editor), historyPanel(editor), zoomPanel(editor, canvas));
}
