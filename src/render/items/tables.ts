// Draw operations for a table item in item-local coordinates: a paper card, the first row tinted as header,
// grid lines and the wrapped text of every cell. Not here: the grid maths (src/table/grid.ts).
import { LINE_HEIGHT, TABLE_FONT_SIZE } from "../../geometry/widths.ts";
import type { TableItem } from "../../model/item.ts";
import { CELL_PADDING } from "../../table/grid.ts";
import { wrapText } from "../measure.ts";
import type { DrawOp } from "../ops.ts";

function r(value: number): number {
  return Math.round(value * 100) / 100;
}

function offsets(fractions: readonly number[], length: number): number[] {
  let sum = 0;
  return [0, ...fractions.map((f) => (sum += f) * length)];
}

export function tableOps(item: TableItem): DrawOp[] {
  const xs = offsets(item.columns, item.width);
  const ys = offsets(item.rows, item.height);
  const [w, h] = [r(item.width), r(item.height)];
  const header = r(ys[1] ?? 0);
  const inner = [
    ...xs.slice(1, -1).map((x) => `M${r(x)} 0V${h}`),
    ...ys.slice(1, -1).map((y) => `M0 ${r(y)}H${w}`),
  ].join("");
  const fontSize = TABLE_FONT_SIZE[item.size];
  const ops: DrawOp[] = [
    {
      kind: "path",
      d: `M0 0H${w}V${h}H0Z`,
      fill: "paper",
      stroke: null,
      width: 0,
      shadow: false,
      opacity: 1,
    },
    {
      kind: "path",
      d: `M0 0H${w}V${header}H0Z`,
      fill: "sun",
      stroke: null,
      width: 0,
      shadow: false,
      opacity: 0.35,
    },
    { kind: "path", d: inner, fill: null, stroke: "ink", width: 1.5, shadow: false, opacity: 1 },
    {
      kind: "path",
      d: `M0 0H${w}V${h}H0Z`,
      fill: null,
      stroke: "ink",
      width: 2.5,
      shadow: false,
      opacity: 1,
    },
  ];
  item.cells.forEach((row, rowIndex) => {
    row.forEach((text, column) => {
      if (text === "") return;
      const width = (xs[column + 1] ?? 0) - (xs[column] ?? 0) - 2 * CELL_PADDING;
      ops.push({
        kind: "text",
        lines: wrapText(text, fontSize, width),
        x: (xs[column] ?? 0) + CELL_PADDING,
        y: (ys[rowIndex] ?? 0) + CELL_PADDING,
        fontSize,
        lineHeight: fontSize * LINE_HEIGHT,
        color: item.color,
        align: "start",
      });
    });
  });
  return ops;
}
