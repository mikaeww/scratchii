// Typing into a table cell: where the field sits, the table it leaves behind, and which cell Tab, Shift+Tab and
// Enter go to (Tab in the last cell and Enter in the last row add a row). Not here: the field itself
// (text-editor.ts) or the grid maths (src/table/grid.ts).
import { LINE_HEIGHT, TABLE_FONT_SIZE } from "../../geometry/widths.ts";
import { reviseItem, type TableItem } from "../../model/item.ts";
import { lineWidth, wrapText } from "../../render/measure.ts";
import { CELL_PADDING, cellBox, relayout, withRow, type Cell } from "../../table/grid.ts";

export function withText(table: TableItem, [row, column]: Cell, value: string): TableItem {
  const cells = table.cells.map((cells, r) =>
    r === row ? cells.map((text, c) => (c === column ? value : text)) : cells,
  );
  const fontSize = TABLE_FONT_SIZE[table.size];
  return relayout({ ...table, cells }, fontSize * LINE_HEIGHT, {
    lines: (text, width) => wrapText(text, fontSize, width).length,
    longestWord: (text) => Math.max(0, ...text.split(/\s+/).map((word) => lineWidth(word, fontSize))),
  });
}

// The table as it is shown while typing: rows already grown for the text, the edited cell left blank because the
// field shows its text.
export function cellDraft(table: TableItem, cell: Cell, value: string): TableItem {
  return withText(withText(table, cell, value), cell, "");
}

export function finishedCell(table: TableItem, cell: Cell, value: string): TableItem | null {
  const before = table.cells[cell[0]]?.[cell[1]] ?? "";
  return before === value ? null : reviseItem(withText(table, cell, value));
}

export function cellField(
  table: TableItem,
  cell: Cell,
): { x: number; y: number; width: number; fontSize: number } {
  const box = cellBox(table, cell);
  return {
    x: box.x + CELL_PADDING,
    y: box.y + CELL_PADDING,
    width: box.width - 2 * CELL_PADDING,
    fontSize: TABLE_FONT_SIZE[table.size],
  };
}

export type CellMove = "next" | "previous" | "down";

export function moveCell(
  table: TableItem,
  [row, column]: Cell,
  move: CellMove,
): { table: TableItem; cell: Cell } {
  const [rows, columns] = [table.cells.length, table.columns.length];
  if (move === "previous") {
    const index = Math.max(0, row * columns + column - 1);
    return { table, cell: [Math.floor(index / columns), index % columns] };
  }
  const next: Cell =
    move === "down" ? [row + 1, column] : column + 1 < columns ? [row, column + 1] : [row + 1, 0];
  if (next[0] < rows) return { table, cell: next };
  const grown = withRow(table, rows);
  return grown === table ? { table, cell: [row, column] } : { table: reviseItem(grown), cell: next };
}
