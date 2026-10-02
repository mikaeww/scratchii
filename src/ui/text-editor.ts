// The textarea laid over the canvas while a text or note is edited. Commits on blur, Escape or Ctrl+Enter;
// an emptied text is deleted.
import type { Editor } from "../editor/editor.ts";
import type { TextEditing } from "../editor/tools/text.ts";
import { worldToScreen } from "../editor/viewport.ts";
import { LINE_HEIGHT, NOTE_FONT_SIZE, NOTE_PADDING } from "../geometry/widths.ts";
import { reviseItem, updateItem, type NoteItem, type TextItem } from "../model/item.ts";
import { measureBlock, wrapText } from "../render/measure.ts";

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

  area.addEventListener("input", place);
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
