// Right-click entries for a table: rows and columns around the clicked cell, and a chart of the table's numbers
// placed next to it. Not here: the menu itself (context-menu.ts).
import type { Editor } from "../../editor/editor.ts";
import { createItem, reviseItem, type ChartItem, type TableItem } from "../../model/item.ts";
import { chartData, withColumn, withRow, withoutColumn, withoutRow, type Cell } from "../../table/grid.ts";
import { showToast } from "../toast.ts";
import { text, type TextKey } from "../text.ts";

type Entry = (label: TextKey, action: () => void) => HTMLElement;

const CHART_GAP = 40;

function chartBeside(editor: Editor, table: TableItem, kind: ChartItem["kind"]): void {
  const data = chartData(table.cells);
  if (data === null) {
    showToast(text("table.noNumbers"), "error");
    return;
  }
  const chart = createItem<ChartItem>({
    type: "chart",
    x: table.x + table.width + CHART_GAP,
    y: table.y,
    color: "ink",
    size: table.size,
    width: 480,
    height: 300,
    kind,
    ...data,
  });
  editor.commit([chart]);
  editor.setSelection([chart.id]);
}

export function tableEntries(
  editor: Editor,
  table: TableItem,
  [row, column]: Cell,
  entry: Entry,
): HTMLElement[] {
  const change = (edit: (t: TableItem) => TableItem) => () => {
    const next = edit(table);
    if (next !== table) editor.commit([reviseItem(next)]);
  };
  return [
    entry(
      "table.rowAbove",
      change((t) => withRow(t, row)),
    ),
    entry(
      "table.rowBelow",
      change((t) => withRow(t, row + 1)),
    ),
    entry(
      "table.columnLeft",
      change((t) => withColumn(t, column)),
    ),
    entry(
      "table.columnRight",
      change((t) => withColumn(t, column + 1)),
    ),
    entry(
      "table.deleteRow",
      change((t) => withoutRow(t, row)),
    ),
    entry(
      "table.deleteColumn",
      change((t) => withoutColumn(t, column)),
    ),
    entry("table.barChart", () => {
      chartBeside(editor, table, "bar");
    }),
    entry("table.lineChart", () => {
      chartBeside(editor, table, "line");
    }),
  ];
}
