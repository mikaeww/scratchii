// Text and sticky notes: a click opens the text editor on the item under the pointer, or on a new one.
import { itemAt } from "../../geometry/hit.ts";
import { FONT_SIZE, LINE_HEIGHT } from "../../geometry/widths.ts";
import { createItem, type NoteItem, type TableItem, type TextItem } from "../../model/item.ts";
import { cellAt, type Cell } from "../../table/grid.ts";
import type { Editor } from "../editor.ts";
import type { Vec } from "../viewport.ts";
import type { Tool } from "./tool.ts";

export interface TextEditing {
  edit(item: TextItem | NoteItem, isNew: boolean): void;
  editCell(table: TableItem, cell: Cell): void;
  isEditing(): boolean;
}

const REACH = 6;
const NOTE_WIDTH = 220;
const NOTE_HEIGHT = 160;

export function newText(editor: Editor, at: Vec): TextItem {
  const fontSize = FONT_SIZE[editor.style.size];
  const { color, size } = editor.style;
  // The click lands in the middle of the first line, where the caret appears.
  const y = at[1] - (fontSize * LINE_HEIGHT) / 2;
  return createItem<TextItem>({
    type: "text",
    x: at[0],
    y,
    color,
    size,
    text: "",
    fontSize,
    width: 0,
    height: 0,
  });
}

function newNote(editor: Editor, at: Vec): NoteItem {
  const { fill, size } = editor.style;
  // A white or empty fill would make the note vanish into the canvas; notes default to yellow.
  const noteFill = fill === null || fill === "paper" ? "sun" : fill;
  const x = at[0] - NOTE_WIDTH / 2;
  const y = at[1] - NOTE_HEIGHT / 2;
  return createItem<NoteItem>({
    type: "note",
    x,
    y,
    color: "ink",
    size,
    text: "",
    width: NOTE_WIDTH,
    height: NOTE_HEIGHT,
    fill: noteFill,
  });
}

export function editAt(editor: Editor, editing: TextEditing, at: Vec): boolean {
  const hit = itemAt(editor.scene(), at, REACH / editor.view.zoom);
  const cell = hit?.type === "table" ? cellAt(hit, at) : null;
  if (hit?.type === "table" && cell !== null) {
    editing.editCell(hit, cell);
    return true;
  }
  if (hit?.type !== "text" && hit?.type !== "note") return false;
  editing.edit(hit, false);
  return true;
}

export function createTextTool(editor: Editor, kind: "text" | "note", editing: TextEditing): Tool {
  // A click that only ends the current edit must not start a new one.
  let endedEdit = false;
  return {
    cursor: kind === "text" ? "text" : "copy",
    down() {
      endedEdit = editing.isEditing();
    },
    move() {},
    up(sample) {
      if (endedEdit || editAt(editor, editing, sample.world)) return;
      editing.edit(kind === "text" ? newText(editor, sample.world) : newNote(editor, sample.world), true);
    },
    cancel() {},
  };
}
