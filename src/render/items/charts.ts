// Draw operations for graph and chart items in item-local coordinates: a paper card with grid, axes, tick labels
// and the curves, bars or line. Not here: sampling and ticks (src/calc/plot.ts).
import { compileFunction, niceTicks, plotSegments, type Range } from "../../calc/plot.ts";
import { formatNumber } from "../../calc/answer.ts";
import type { ChartItem, Color, GraphItem } from "../../model/item.ts";
import type { DrawOp, PathOp, TextOp } from "../ops.ts";

// Room for tick labels left of and below the plot, and a little air on the other two sides (world units).
const PAD = { left: 44, right: 14, top: 14, bottom: 30 } as const;
const LABEL_SIZE = 13;
const LEGEND_SIZE = 15;
const CURVE_WIDTH = 3;
// Curves and bars cycle through the palette; ink stays for axes and text.
export const SERIES_COLORS: readonly Color[] = ["coral", "sky", "teal", "violet", "orange", "pink", "sun"];

function r(value: number): number {
  return Math.round(value * 100) / 100;
}

function path(d: string, stroke: Color | null, width: number, extra: Partial<PathOp> = {}): PathOp {
  return { kind: "path", d, fill: null, stroke, width, shadow: false, opacity: 1, ...extra };
}

function label(content: string, x: number, y: number, align: TextOp["align"], color: Color = "ink"): TextOp {
  return {
    kind: "text",
    lines: [content],
    x,
    y,
    fontSize: LABEL_SIZE,
    lineHeight: LABEL_SIZE * 1.2,
    color,
    align,
  };
}

function card(width: number, height: number): PathOp {
  return path(`M0 0H${r(width)}V${r(height)}H0Z`, "ink", 2, { fill: "paper" });
}

interface Frame {
  readonly x: (value: number) => number;
  readonly y: (value: number) => number;
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
}

function frameOf(width: number, height: number, range: Range): Frame {
  const [xMin, xMax, yMin, yMax] = range;
  const [left, right] = [PAD.left, Math.max(PAD.left + 1, width - PAD.right)];
  const [top, bottom] = [PAD.top, Math.max(PAD.top + 1, height - PAD.bottom)];
  return {
    x: (value) => left + ((value - xMin) / (xMax - xMin)) * (right - left),
    y: (value) => bottom - ((value - yMin) / (yMax - yMin)) * (bottom - top),
    left,
    right,
    top,
    bottom,
  };
}

function gridAndTicks(frame: Frame, range: Range, xTicks: boolean): DrawOp[] {
  const [xMin, xMax, yMin, yMax] = range;
  const xs = xTicks ? niceTicks(xMin, xMax) : [];
  const ys = niceTicks(yMin, yMax, 5);
  const grid = [
    ...xs.map((t) => `M${r(frame.x(t))} ${r(frame.top)}V${r(frame.bottom)}`),
    ...ys.map((t) => `M${r(frame.left)} ${r(frame.y(t))}H${r(frame.right)}`),
  ].join("");
  const axes = [
    xMin <= 0 && xMax >= 0 && xTicks ? `M${r(frame.x(0))} ${r(frame.top)}V${r(frame.bottom)}` : "",
    yMin <= 0 && yMax >= 0
      ? `M${r(frame.left)} ${r(frame.y(0))}H${r(frame.right)}`
      : `M${r(frame.left)} ${r(frame.bottom)}H${r(frame.right)}`,
  ].join("");
  return [
    path(grid, "ink", 1, { opacity: 0.12 }),
    path(axes, "ink", 1.5),
    ...xs.map((t) => label(formatNumber(t, false), frame.x(t), frame.bottom + 6, "middle")),
    ...ys.map((t) => label(formatNumber(t, false), frame.left - 6, frame.y(t) - LABEL_SIZE * 0.6, "end")),
  ];
}

function curve(source: string, frame: Frame, range: Range, color: Color): PathOp | null {
  let f: (x: number) => number;
  try {
    f = compileFunction(source);
  } catch {
    // Validation keeps only short strings, not parseable ones; an unreadable function is shown in the legend
    // with a question mark and draws nothing.
    return null;
  }
  const d = plotSegments(f, range)
    .map((segment) =>
      segment.map(([x, y], i) => `${i === 0 ? "M" : "L"}${r(frame.x(x))} ${r(frame.y(y))}`).join(""),
    )
    .join("");
  return d === "" ? null : path(d, color, CURVE_WIDTH);
}

export function graphOps(item: GraphItem): DrawOp[] {
  const frame = frameOf(item.width, item.height, item.range);
  const ops: DrawOp[] = [card(item.width, item.height), ...gridAndTicks(frame, item.range, true)];
  item.functions.forEach((source, i) => {
    const color = SERIES_COLORS[i % SERIES_COLORS.length] ?? "ink";
    const line = curve(source, frame, item.range, color);
    if (line !== null) ops.push(line);
    ops.push({
      kind: "text",
      lines: [`${line === null ? "? " : ""}y = ${source}`],
      x: frame.left + 8,
      y: frame.top + 4 + i * LEGEND_SIZE * 1.3,
      fontSize: LEGEND_SIZE,
      lineHeight: LEGEND_SIZE * 1.3,
      color,
      align: "start",
    });
  });
  return ops;
}

function chartRange(values: readonly number[]): Range {
  const low = Math.min(0, ...values);
  const high = Math.max(0, ...values);
  const span = high - low || 1;
  return [0, 1, low - (low < 0 ? span * 0.08 : 0), high + span * 0.12];
}

export function chartOps(item: ChartItem): DrawOp[] {
  const range = chartRange(item.values);
  const frame = frameOf(item.width, item.height, range);
  const slot = (frame.right - frame.left) / Math.max(1, item.values.length);
  const centre = (i: number): number => frame.left + slot * (i + 0.5);
  const ops: DrawOp[] = [card(item.width, item.height), ...gridAndTicks(frame, range, false)];
  item.values.forEach((value, i) => {
    const [x, y] = [centre(i), frame.y(value)];
    if (item.kind === "bar") {
      const [half, base] = [slot * 0.3, frame.y(0)];
      const fill = SERIES_COLORS[i % SERIES_COLORS.length] ?? "sky";
      ops.push(path(`M${r(x - half)} ${r(base)}V${r(y)}H${r(x + half)}V${r(base)}Z`, "ink", 2, { fill }));
    } else {
      ops.push(path(`M${r(x - 4)} ${r(y)}a4 4 0 1 0 8 0a4 4 0 1 0-8 0Z`, "ink", 2, { fill: item.color }));
    }
    ops.push(label(item.labels[i] ?? "", x, frame.bottom + 6, "middle"));
    // Above a positive bar, below a negative one, so the number never sits inside the bar.
    const valueY = value < 0 ? y + 4 : y - LABEL_SIZE * 1.4;
    ops.push(label(formatNumber(value, false), x, valueY, "middle"));
  });
  if (item.kind === "line") {
    const d = item.values.map((v, i) => `${i === 0 ? "M" : "L"}${r(centre(i))} ${r(frame.y(v))}`).join("");
    ops.splice(ops.length - item.values.length * 3, 0, path(d, item.color, CURVE_WIDTH));
  }
  return ops;
}
