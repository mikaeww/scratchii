// The grid of a table item: cell boxes, the cell under a point, rows and columns added or removed, row heights
// that fit the text, tables from tab-separated text, and a chart's data from a table. Pure; the text measure
// comes from the caller. Not here: drawing (src/render/items/tables.ts) or typing into cells (src/ui).
import type { Box } from "../geometry/box.ts";
import type { TableItem } from "../model/item.ts";
import { MAX_COLUMNS, MAX_ROWS, MAX_VALUES } from "../model/validate.ts";

export type Cells = readonly (readonly string[])[];
export type Cell = readonly [row: number, column: number];
// How cell text measures: wrapped lines at a width, and the widest single word. The browser measures, tests
// count characters.
export interface TextMeasure {
  readonly lines: (text: string, width: number) => number;
  readonly longestWord: (text: string) => number;
}

// Inner padding of a cell and the default column width (world units).
export const CELL_PADDING = 8;
export const COLUMN_WIDTH = 140;
// Widths are stored as fractions; a column exactly as wide as its word could come back a hair narrower.
const WORD_SLACK = 1;

function starts(fractions: readonly number[], length: number): number[] {
  let sum = 0;
  return fractions.map((fraction) => {
    const start = sum * length;
    sum += fraction;
    return start;
  });
}

export function cellBox(table: TableItem, [row, column]: Cell): Box {
  const xs = starts(table.columns, table.width);
  const ys = starts(table.rows, table.height);
  return {
    x: table.x + (xs[column] ?? 0),
    y: table.y + (ys[row] ?? 0),
    width: (table.columns[column] ?? 0) * table.width,
    height: (table.rows[row] ?? 0) * table.height,
  };
}

function indexAt(fractions: readonly number[], offset: number): number {
  let sum = 0;
  for (const [index, fraction] of fractions.entries()) {
    sum += fraction;
    if (offset < sum) return index;
  }
  return fractions.length - 1;
}

export function cellAt(table: TableItem, [x, y]: readonly [number, number]): Cell | null {
  const u = (x - table.x) / table.width;
  const v = (y - table.y) / table.height;
  if (!(u >= 0 && u <= 1 && v >= 0 && v <= 1)) return null;
  return [indexAt(table.rows, v), indexAt(table.columns, u)];
}

// Equal shares for n parts.
export function even(count: number): number[] {
  return Array.from({ length: count }, () => 1 / count);
}

function insertAt<T>(list: readonly T[], index: number, value: T): T[] {
  return [...list.slice(0, index), value, ...list.slice(index)];
}

function withoutIndex<T>(list: readonly T[], index: number): T[] {
  return list.filter((_, i) => i !== index);
}

// The new row takes the average height; the others shrink in proportion, so the fractions still sum to 1.
function addShare(fractions: readonly number[], index: number): number[] {
  const share = 1 / (fractions.length + 1);
  return insertAt(
    fractions.map((f) => f * (1 - share)),
    index,
    share,
  );
}

function dropShare(fractions: readonly number[], index: number): number[] {
  const rest = withoutIndex(fractions, index);
  const sum = rest.reduce((a, b) => a + b, 0);
  return rest.map((f) => f / sum);
}

export function withRow(table: TableItem, index: number): TableItem {
  if (table.cells.length >= MAX_ROWS) return table;
  const empty = table.columns.map(() => "");
  const extra = table.height / table.rows.length;
  return {
    ...table,
    height: table.height + extra,
    cells: insertAt(table.cells, index, empty),
    rows: addShare(table.rows, index),
  };
}

export function withColumn(table: TableItem, index: number): TableItem {
  if (table.columns.length >= MAX_COLUMNS) return table;
  const extra = table.width / table.columns.length;
  return {
    ...table,
    width: table.width + extra,
    cells: table.cells.map((row) => insertAt(row, index, "")),
    columns: addShare(table.columns, index),
  };
}

export function withoutRow(table: TableItem, index: number): TableItem {
  if (table.cells.length <= 1) return table;
  const removed = (table.rows[index] ?? 0) * table.height;
  return {
    ...table,
    height: table.height - removed,
    cells: withoutIndex(table.cells, index),
    rows: dropShare(table.rows, index),
  };
}

export function withoutColumn(table: TableItem, index: number): TableItem {
  if (table.columns.length <= 1) return table;
  const removed = (table.columns[index] ?? 0) * table.width;
  return {
    ...table,
    width: table.width - removed,
    cells: table.cells.map((row) => withoutIndex(row, index)),
    columns: dropShare(table.columns, index),
  };
}

function shares(sizes: readonly number[]): { total: number; fractions: number[] } {
  const total = sizes.reduce((a, b) => a + b, 0);
  return { total, fractions: sizes.map((size) => size / total) };
}

// Columns widen to their longest word and rows grow to their tallest cell; neither ever shrinks.
export function relayout(table: TableItem, lineHeight: number, measure: TextMeasure): TableItem {
  const widths = table.columns.map((fraction, c) =>
    Math.max(
      fraction * table.width,
      ...table.cells.map((row) => measure.longestWord(row[c] ?? "") + 2 * CELL_PADDING + WORD_SLACK),
    ),
  );
  const minimum = lineHeight + 2 * CELL_PADDING;
  const heights = table.cells.map((row, r) => {
    const needed = row.map((text, c) => {
      const lines = measure.lines(text, (widths[c] ?? 0) - 2 * CELL_PADDING);
      return Math.max(1, lines) * lineHeight + 2 * CELL_PADDING;
    });
    return Math.max(minimum, (table.rows[r] ?? 0) * table.height, ...needed);
  });
  const columns = shares(widths);
  const rows = shares(heights);
  return {
    ...table,
    width: columns.total,
    height: rows.total,
    columns: columns.fractions,
    rows: rows.fractions,
  };
}

// Tab-separated text (Excel, LibreOffice, a web table) with at least two cells; ragged rows get empty cells.
export function readTsv(text: string): string[][] | null {
  if (!text.includes("\t")) return null;
  const rows = text
    .replace(/\r\n?/g, "\n")
    .replace(/\n+$/, "")
    .split("\n")
    .map((line) => line.split("\t"));
  const width = Math.max(...rows.map((row) => row.length));
  if (rows.length > MAX_ROWS || width > MAX_COLUMNS) return null;
  return rows.map((row) => [...row, ...Array.from({ length: width - row.length }, () => "")]);
}

function numberIn(text: string): number | null {
  const match = /^\s*(-?\d+(?:[.,]\d+)?)\s*[%€$]?\s*$/.exec(text);
  return match === null ? null : Number((match[1] ?? "").replace(",", "."));
}

// Labels from the first column, values from the first column holding numbers; a first row without a number
// there is a header and skipped.
export function chartData(cells: Cells): { labels: string[]; values: number[] } | null {
  const width = cells[0]?.length ?? 0;
  for (let column = 1; column < width; column++) {
    const header = numberIn(cells[0]?.[column] ?? "") === null ? 1 : 0;
    const rows = cells
      .slice(header)
      .filter((row) => numberIn(row[column] ?? "") !== null)
      .slice(0, MAX_VALUES);
    if (rows.length === 0) continue;
    return {
      labels: rows.map((row) => (row[0] ?? "").slice(0, 200)),
      values: rows.map((row) => numberIn(row[column] ?? "") ?? 0),
    };
  }
  return null;
}
