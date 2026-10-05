// Keyboard shortcuts and clipboard events. Not here: pointer input (input.ts).
import {
  copySelected,
  deleteSelected,
  duplicateSelected,
  nudgeSelected,
  pasteItems,
  restack,
  selectAll,
} from "./commands.ts";
import type { Editor, ToolName } from "./editor.ts";

const TOOL_KEYS: Readonly<Record<string, ToolName>> = {
  v: "select",
  h: "hand",
  p: "pen",
  m: "marker",
  r: "rect",
  o: "ellipse",
  "3": "triangle",
  d: "diamond",
  s: "star",
  l: "line",
  a: "arrow",
  t: "text",
  n: "note",
  e: "eraser",
};

const ARROWS: Readonly<Record<string, readonly [number, number]>> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

function commandKey(event: KeyboardEvent, editor: Editor): boolean {
  switch (event.key.toLowerCase()) {
    case "z":
      if (event.shiftKey) editor.redo();
      else editor.undo();
      return true;
    case "y":
      editor.redo();
      return true;
    case "a":
      selectAll(editor);
      return true;
    case "d":
      duplicateSelected(editor);
      return true;
    default:
      return false;
  }
}

function plainKey(event: KeyboardEvent, editor: Editor): boolean {
  const arrow = ARROWS[event.key];
  if (arrow !== undefined && editor.selection.size > 0) {
    const step = event.shiftKey ? 10 : 1;
    nudgeSelected(editor, arrow[0] * step, arrow[1] * step);
    return true;
  }
  if (event.key === "Delete" || event.key === "Backspace") {
    deleteSelected(editor);
    return true;
  }
  if (event.key === "Escape") {
    editor.setSelection([]);
    return true;
  }
  if (event.key === "]" || event.key === "[") {
    restack(editor, event.key === "]");
    return true;
  }
  const tool = TOOL_KEYS[event.key.toLowerCase()];
  if (tool === undefined || event.altKey) return false;
  editor.setTool(tool);
  return true;
}

export function handleShortcut(event: KeyboardEvent, editor: Editor): boolean {
  return event.ctrlKey || event.metaKey ? commandKey(event, editor) : plainKey(event, editor);
}

export function attachClipboard(editor: Editor, isTyping: (target: EventTarget | null) => boolean): void {
  const copy = (event: ClipboardEvent): string | null => {
    if (isTyping(event.target)) return null;
    const text = copySelected(editor);
    if (text === null) return null;
    event.clipboardData?.setData("text/plain", text);
    event.preventDefault();
    return text;
  };
  document.addEventListener("copy", copy);
  document.addEventListener("cut", (event) => {
    if (copy(event) !== null) deleteSelected(editor);
  });
  document.addEventListener("paste", (event) => {
    if (isTyping(event.target)) return;
    const text = event.clipboardData?.getData("text/plain") ?? "";
    if (pasteItems(editor, text)) event.preventDefault();
  });
}
