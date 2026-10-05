// New tables: an empty grid from the palette ("3x4" is rows by columns) or a pasted block of tab-separated
// cells from a spreadsheet, rows fitted to their text and placed in the middle of the view.
import { insertAt } from "../../editor/commands.ts";
import type { Editor } from "../../editor/editor.ts";
import type { Vec } from "../../editor/viewport.ts";
import { LINE_HEIGHT, TABLE_FONT_SIZE } from "../../geometry/widths.ts";
import { createItem, type TableItem } from "../../model/item.ts";
import { MAX_COLUMNS, MAX_ROWS } from "../../model/validate.ts";
import { CELL_PADDING, COLUMN_WIDTH, even, readTsv } from "../../table/grid.ts";
import { withText } from "./cells.ts";

export function placeTable(editor: Editor, cells: readonly (readonly string[])[], at: Vec): TableItem | null {
  const columns = cells[0]?.length ?? 0;
  if (cells.length === 0 || columns === 0) return null;
  const { color, size } = editor.style;
  const row = TABLE_FONT_SIZE[size] * LINE_HEIGHT + 2 * CELL_PADDING;
  const empty = createItem<TableItem>({
    type: "table",
    x: 0,
    y: 0,
    color,
    size,
    width: columns * COLUMN_WIDTH,
    height: cells.length * row,
    cells,
    columns: even(columns),
    rows: even(cells.length),
  });
  // Fitting one cell relays out every row; the first cell is enough to grow them all to their text.
  const table = withText(empty, [0, 0], cells[0]?.[0] ?? "");
  insertAt(editor, [table], at);
  return table;
}

// "3x4", "3 x 4", "3*4" or "3×4"; anything else is the default 3 by 3.
export function tableSize(argument: string): [rows: number, columns: number] {
  const match = /^\s*(\d+)\s*[x×*]\s*(\d+)\s*$/i.exec(argument);
  const rows = Math.min(MAX_ROWS, Math.max(1, Number(match?.[1] ?? 3)));
  const columns = Math.min(MAX_COLUMNS, Math.max(1, Number(match?.[2] ?? 3)));
  return [rows, columns];
}

export function attachTablePaste(
  editor: Editor,
  centre: () => Vec,
  isTyping: (target: EventTarget | null) => boolean,
): void {
  document.addEventListener("paste", (event) => {
    if (isTyping(event.target)) return;
    const cells = readTsv(event.clipboardData?.getData("text/plain") ?? "");
    if (cells === null) return;
    event.preventDefault();
    placeTable(editor, cells, centre());
  });
}
