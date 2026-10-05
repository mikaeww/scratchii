// The textarea laid over the canvas while a text or note is edited. Commits on blur, Escape or Ctrl+Enter;
// an emptied text is deleted. Typing "=" after maths at the end of a line puts the answer after it.
import { answerFor, type Answer } from "../calc/answer.ts";
import type { Editor } from "../editor/editor.ts";
import type { TextEditing } from "../editor/tools/text.ts";
import { worldToScreen } from "../editor/viewport.ts";
import { LINE_HEIGHT, NOTE_FONT_SIZE, NOTE_PADDING } from "../geometry/widths.ts";
import { reviseItem, updateItem, type NoteItem, type TextItem } from "../model/item.ts";
import { measureBlock, wrapText } from "../render/measure.ts";
import { text } from "./text.ts";

interface Session {
  readonly item: TextItem | NoteItem;
  readonly isNew: boolean;
}

function fontSizeOf(item: TextItem | NoteItem): number {
  return item.type === "text" ? item.fontSize : NOTE_FONT_SIZE[item.size];
}

function noteHeight(note: NoteItem, text: string): number {
  const fontSize = NOTE_FONT_SIZE[note.size];
  const lines = wrapText(text, fontSize, note.width - 2 * NOTE_PADDING).length;
  return Math.max(note.height, Math.ceil(lines * fontSize * LINE_HEIGHT + 2 * NOTE_PADDING));
}

function finished(session: Session, text: string): TextItem | NoteItem | null {
  const { item, isNew } = session;
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

export function mountTextEditor(root: HTMLElement, editor: Editor): TextEditing {
  const area = document.createElement("textarea");
  area.className = "text-editor";
  area.hidden = true;
  area.spellcheck = false;
  root.append(area);
  let session: Session | null = null;

  const place = (): void => {
    if (session === null) return;
    const { item } = session;
    const zoom = editor.view.zoom;
    const fontSize = fontSizeOf(item);
    const inset = item.type === "note" ? NOTE_PADDING : 0;
    const [left, top] = worldToScreen(editor.view, [item.x + inset, item.y + inset]);
    const block = measureBlock(area.value || " ", fontSize);
    const width = item.type === "note" ? item.width - 2 * NOTE_PADDING : block.width + fontSize;
    area.style.cssText = `left:${left}px;top:${top}px;font-size:${fontSize * zoom}px;line-height:${LINE_HEIGHT};width:${width * zoom}px;height:${block.height * zoom}px;color:var(--${item.color})`;
    area.classList.toggle("wrap", item.type === "note");
    if (item.type === "note") editor.setDraft([{ ...item, text: "", height: noteHeight(item, area.value) }]);
  };

  const finish = (): void => {
    if (session === null) return;
    const done = finished(session, area.value.replace(/\s+$/, ""));
    session = null;
    area.hidden = true;
    editor.setDraft([]);
    if (done !== null) editor.commit([done]);
  };

  area.addEventListener("input", (event) => {
    answerAtCaret(area, event);
    place();
  });
  area.addEventListener("blur", finish);
  area.addEventListener("keydown", (event) => {
    if (event.key === "Escape" || (event.key === "Enter" && (event.ctrlKey || event.metaKey))) {
      event.preventDefault();
      area.blur();
    }
  });
  editor.on((change) => {
    if (change === "view") place();
  });

  return {
    edit(item, isNew) {
      finish();
      session = { item, isNew };
      area.value = item.text;
      editor.setDraft([{ ...item, text: "" }]);
      area.hidden = false;
      place();
      area.focus();
      area.setSelectionRange(area.value.length, area.value.length);
    },
    isEditing: () => session !== null,
  };
}
