// The textarea laid over the canvas while a text, a note or a table cell is edited. Commits on blur, Escape or
// Ctrl+Enter; an emptied text is deleted. In a cell, Tab, Shift+Tab and Enter move on (cells.ts). Typing "="
// after maths at the end of a line puts the answer after it.
import { answerFor, type Answer } from "../../calc/answer.ts";
import type { Editor } from "../../editor/editor.ts";
import type { TextEditing } from "../../editor/tools/text.ts";
import { worldToScreen } from "../../editor/viewport.ts";
import { LINE_HEIGHT, NOTE_FONT_SIZE, NOTE_PADDING } from "../../geometry/widths.ts";
import {
  reviseItem,
  updateItem,
  type Item,
  type NoteItem,
  type TableItem,
  type TextItem,
} from "../../model/item.ts";
import { measureBlock, wrapText } from "../../render/measure.ts";
import type { Cell } from "../../table/grid.ts";
import { text } from "../text.ts";
import { cellDraft, cellField, finishedCell, moveCell, type CellMove } from "./cells.ts";

type Session =
  | { readonly kind: "text"; readonly item: TextItem | NoteItem; readonly isNew: boolean }
  | { readonly kind: "cell"; readonly table: TableItem; readonly cell: Cell };

function fontSizeOf(item: TextItem | NoteItem): number {
  return item.type === "text" ? item.fontSize : NOTE_FONT_SIZE[item.size];
}

function noteHeight(note: NoteItem, text: string): number {
  const fontSize = NOTE_FONT_SIZE[note.size];
  const lines = wrapText(text, fontSize, note.width - 2 * NOTE_PADDING).length;
  return Math.max(note.height, Math.ceil(lines * fontSize * LINE_HEIGHT + 2 * NOTE_PADDING));
}

function finishedText(item: TextItem | NoteItem, isNew: boolean, text: string): TextItem | NoteItem | null {
  if (text.trim() === "") return isNew ? null : updateItem(item, { deleted: true });
  if (item.type === "note") return reviseItem({ ...item, text, height: noteHeight(item, text) });
  return reviseItem({ ...item, text, ...measureBlock(text, item.fontSize) });
}

// A subnet answer takes one line per fact, so it stays readable in a note.
function worded(answer: Answer): string {
  if (answer.kind === "value") return answer.text;
  const { network, broadcast, mask, hosts, first, last } = answer.subnet;
  const range = first === null || last === null ? "" : ` (${first} – ${last})`;
  return [
    `${text("calc.network")} ${network}`,
    `${text("calc.mask")} ${mask}`,
    `${text("calc.broadcast")} ${broadcast}`,
    `${hosts} ${text("calc.hosts")}${range}`,
  ].join("\n");
}

// Only when the "=" ends its line, so editing an old sum does not stack a second answer behind it.
function answerAtCaret(area: HTMLTextAreaElement, event: Event): void {
  if (!(event instanceof InputEvent) || event.data !== "=") return;
  const caret = area.selectionStart;
  const after = area.value.slice(caret);
  if (after !== "" && !after.startsWith("\n")) return;
  const line = area.value.slice(area.value.lastIndexOf("\n", caret - 1) + 1, caret);
  const answer = answerFor(line);
  if (answer === null) return;
  area.setRangeText(` ${worded(answer)}`, caret, caret, "end");
}

function cellMove(event: KeyboardEvent): CellMove | null {
  if (event.key === "Tab") return event.shiftKey ? "previous" : "next";
  return event.key === "Enter" && !event.shiftKey && !event.ctrlKey && !event.metaKey ? "down" : null;
}

function style(left: number, top: number, fontSize: number, size: readonly [number, number]): string {
  return `left:${left}px;top:${top}px;font-size:${fontSize}px;line-height:${LINE_HEIGHT};width:${size[0]}px;height:${size[1]}px`;
}

function placeText(area: HTMLTextAreaElement, editor: Editor, item: TextItem | NoteItem): void {
  const zoom = editor.view.zoom;
  const fontSize = fontSizeOf(item);
  const inset = item.type === "note" ? NOTE_PADDING : 0;
  const [left, top] = worldToScreen(editor.view, [item.x + inset, item.y + inset]);
  const block = measureBlock(area.value || " ", fontSize);
  const width = item.type === "note" ? item.width - 2 * NOTE_PADDING : block.width + fontSize;
  area.style.cssText = `${style(left, top, fontSize * zoom, [width * zoom, block.height * zoom])};color:var(--${item.color})`;
  area.classList.toggle("wrap", item.type === "note");
  if (item.type === "note") editor.setDraft([{ ...item, text: "", height: noteHeight(item, area.value) }]);
}

function placeCell(area: HTMLTextAreaElement, editor: Editor, table: TableItem, cell: Cell): void {
  const zoom = editor.view.zoom;
  const draft = cellDraft(table, cell, area.value);
  const field = cellField(draft, cell);
  const [left, top] = worldToScreen(editor.view, [field.x, field.y]);
  const lines = wrapText(area.value || " ", field.fontSize, field.width).length;
  const height = lines * field.fontSize * LINE_HEIGHT;
  area.style.cssText = `${style(left, top, field.fontSize * zoom, [field.width * zoom, height * zoom])};color:var(--${table.color})`;
  area.classList.add("wrap");
  editor.setDraft([draft]);
}

function createArea(root: HTMLElement): HTMLTextAreaElement {
  const area = document.createElement("textarea");
  area.className = "text-editor";
  area.hidden = true;
  area.spellcheck = false;
  root.append(area);
  return area;
}

function finishedSession(session: Session, value: string): Item | null {
  return session.kind === "text"
    ? finishedText(session.item, session.isNew, value)
    : finishedCell(session.table, session.cell, value);
}

// Tab, Shift+Tab and Enter move between cells when `onMove` takes them; Escape and Ctrl+Enter end the edit.
function attachKeys(area: HTMLTextAreaElement, onMove: (move: CellMove) => boolean): void {
  area.addEventListener("keydown", (event) => {
    const move = cellMove(event);
    if (move !== null && onMove(move)) {
      event.preventDefault();
    } else if (event.key === "Escape" || (event.key === "Enter" && (event.ctrlKey || event.metaKey))) {
      event.preventDefault();
      area.blur();
    }
  });
}

// The next cell opens on the table as committed, so a row added by Tab is part of the same history.
function commitAndMove(
  editor: Editor,
  { table, cell }: Extract<Session, { kind: "cell" }>,
  value: string,
  move: CellMove,
): { table: TableItem; cell: Cell } {
  const next = moveCell(finishedCell(table, cell, value) ?? table, cell, move);
  editor.setDraft([]);
  if (next.table !== table) editor.commit([next.table]);
  return next;
}

export function mountTextEditor(root: HTMLElement, editor: Editor): TextEditing {
  const area = createArea(root);
  let session: Session | null = null;
  const typed = (): string => area.value.replace(/\s+$/, "");
  const place = (): void => {
    if (session?.kind === "text") placeText(area, editor, session.item);
    else if (session?.kind === "cell") placeCell(area, editor, session.table, session.cell);
  };
  const finish = (): void => {
    if (session === null) return;
    const done = finishedSession(session, typed());
    session = null;
    area.hidden = true;
    editor.setDraft([]);
    if (done !== null) editor.commit([done]);
  };
  const open = (next: Session, value: string): void => {
    session = next;
    area.value = value;
    area.hidden = false;
    place();
    area.focus();
    area.setSelectionRange(area.value.length, area.value.length);
  };
  const editCell = (table: TableItem, cell: Cell): void => {
    open({ kind: "cell", table, cell }, table.cells[cell[0]]?.[cell[1]] ?? "");
  };
  area.addEventListener("input", (event) => {
    answerAtCaret(area, event);
    place();
  });
  area.addEventListener("blur", finish);
  editor.on((change) => {
    if (change === "view") place();
  });
  attachKeys(area, (move) => {
    if (session?.kind !== "cell") return false;
    const next = commitAndMove(editor, session, typed(), move);
    session = null;
    editCell(next.table, next.cell);
    return true;
  });
  return {
    edit(item, isNew) {
      finish();
      editor.setDraft([{ ...item, text: "" }]);
      open({ kind: "text", item, isNew }, item.text);
    },
    editCell(table, cell) {
      finish();
      editCell(table, cell);
    },
    isEditing: () => session !== null,
  };
}
