// Editing commands on the selection, shared by keyboard shortcuts and buttons.
import { moveItem } from "../geometry/transform.ts";
import { shapeBox } from "../geometry/bounds.ts";
import { unite } from "../geometry/box.ts";
import { LINE_HEIGHT } from "../geometry/widths.ts";
import {
  createItem,
  reviseItem,
  updateItem,
  type Item,
  type StrokeItem,
  type TextItem,
} from "../model/item.ts";
import { validateItem } from "../model/validate.ts";
import type { Editor, Style } from "./editor.ts";

const DUPLICATE_OFFSET = 24;
const CLIPBOARD_FORMAT = "scratchii/items";

export function deleteSelected(editor: Editor): void {
  editor.commit(editor.selected().map((item) => updateItem(item, { deleted: true })));
  editor.setSelection([]);
}

function copies(items: readonly Item[], dx: number, dy: number): Item[] {
  return items.map((item) => {
    const {
      id: _id,
      seed: _seed,
      version: _version,
      nonce: _nonce,
      updated: _updated,
      deleted: _deleted,
      ...fields
    } = moveItem(item, dx, dy);
    return createItem(fields as Parameters<typeof createItem>[0]);
  });
}

export function duplicateSelected(editor: Editor): void {
  const created = copies(editor.selected(), DUPLICATE_OFFSET, DUPLICATE_OFFSET);
  editor.commit(created);
  editor.setSelection(created.map((item) => item.id));
}

export function selectAll(editor: Editor): void {
  editor.setSelection(editor.scene().map((item) => item.id));
}

export function nudgeSelected(editor: Editor, dx: number, dy: number): void {
  editor.commit(editor.selected().map((item) => reviseItem(moveItem(item, dx, dy))));
}

export function restack(editor: Editor, toFront: boolean): void {
  const picked = editor.board.items.filter((item) => editor.selection.has(item.id));
  const rest = editor.board.items.filter((item) => !editor.selection.has(item.id));
  if (picked.length > 0) editor.commitOrder(toFront ? [...rest, ...picked] : [...picked, ...rest]);
}

// Sets the style for new items and, if something is selected, applies the same change to it.
export function applyStyle(editor: Editor, change: Partial<Style>): void {
  editor.setStyle(change);
  const changed = editor.selected().map((item) => {
    const { fill, ...rest } = change;
    const fits =
      fill !== undefined &&
      (item.type === "rect" ||
        item.type === "ellipse" ||
        item.type === "polygon" ||
        (item.type === "note" && fill !== null));
    return reviseItem({ ...item, ...rest, ...(fits ? { fill } : {}) } as Item);
  });
  editor.commit(changed);
}

export function copySelected(editor: Editor): string | null {
  const items = editor.selected();
  return items.length === 0 ? null : JSON.stringify({ format: CLIPBOARD_FORMAT, items });
}

// Returns false when the text is not Scratchii content, so the caller can try other formats.
export function pasteItems(editor: Editor, text: string): boolean {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return false;
  }
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    (parsed as { format?: unknown }).format !== CLIPBOARD_FORMAT
  )
    return false;
  const raw = (parsed as { items?: unknown }).items;
  const items = Array.isArray(raw)
    ? raw.map((value, index) => validateItem(value, `clipboard.items[${index}]`))
    : [];
  const created = copies(items, DUPLICATE_OFFSET, DUPLICATE_OFFSET);
  editor.commit(created);
  editor.setSelection(created.map((item) => item.id));
  return true;
}

export type Measure = (text: string, fontSize: number) => { width: number; height: number };

// Replaces handwriting with typed text in one undo step; the text starts where the strokes did and is about
// as tall per line as the handwriting was.
export function strokesToText(
  editor: Editor,
  strokes: readonly StrokeItem[],
  text: string,
  measure: Measure,
): TextItem | null {
  const box = unite(strokes.map(shapeBox));
  const first = strokes[0];
  if (box === null || first === undefined || text.trim() === "") return null;
  const lines = text.split("\n").length;
  const fontSize = Math.round(Math.min(120, Math.max(14, box.height / lines / LINE_HEIGHT)));
  const item = createItem<TextItem>({
    type: "text",
    x: box.x,
    y: box.y,
    color: first.color,
    size: first.size,
    text,
    fontSize,
    ...measure(text, fontSize),
  });
  editor.commit([...strokes.map((stroke) => updateItem(stroke, { deleted: true })), item]);
  editor.setSelection([item.id]);
  return item;
}
