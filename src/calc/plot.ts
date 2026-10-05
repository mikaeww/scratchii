// The maths behind graph and chart items: tick values, a function sampled and clipped to its view, and the
// plain text a graph or chart is edited as. Not here: drawing (src/render/items/charts.ts).
import { ExpressionError, evaluate, parseExpression } from "./expression.ts";

export type Range = readonly [xMin: number, xMax: number, yMin: number, yMax: number];
type Point = readonly [number, number];

export const MAX_FUNCTIONS = 6;
export const MAX_VALUES = 40;
const SAMPLES = 400;

export class PlotTextError extends Error {
  readonly line: number;
  constructor(line: number, problem: string) {
    super(`line ${line}: ${problem}`);
    this.name = "PlotTextError";
    this.line = line;
  }
}

// Steps of 1, 2 or 5 times a power of ten, about `count` of them across [min, max].
export function niceTicks(min: number, max: number, count = 6): number[] {
  const span = max - min;
  if (!(span > 0) || !Number.isFinite(span)) return [];
  const rough = span / count;
  const power = 10 ** Math.floor(Math.log10(rough));
  const step = ([1, 2, 5, 10].find((m) => m * power >= rough) ?? 10) * power;
  const ticks: number[] = [];
  for (let k = Math.ceil(min / step); k * step <= max + step * 1e-9; k++) {
    // k * step instead of repeated adding keeps 0.1 steps from drifting to 0.30000000000000004.
    ticks.push(Number((k * step).toPrecision(12)));
  }
  return ticks.filter((tick) => tick >= min - step * 1e-9 && tick <= max + step * 1e-9);
}

function clipPair(a: Point, b: Point, low: number, high: number): [Point, Point] | null {
  const at = (y: number): Point => {
    const t = (y - a[1]) / (b[1] - a[1]);
    return [a[0] + (b[0] - a[0]) * t, y];
  };
  if ((a[1] < low && b[1] < low) || (a[1] > high && b[1] > high)) return null;
  const start = a[1] < low ? at(low) : a[1] > high ? at(high) : a;
  const end = b[1] < low ? at(low) : b[1] > high ? at(high) : b;
  return [start, end];
}

// Polylines of y = f(x) inside the view. Leaving the view above and coming back below between two samples is
// taken as a pole (tan, 1/x) and splits the line.
// ponytail: a fixed 400 samples; a steep continuous curve crossing the whole view between two samples gets a
// gap there too. Adaptive sampling if that shows up in practice.
export function plotSegments(f: (x: number) => number, range: Range): Point[][] {
  const [xMin, xMax, low, high] = range;
  const samples = Array.from({ length: SAMPLES + 1 }, (_, i): Point => {
    const x = xMin + ((xMax - xMin) * i) / SAMPLES;
    return [x, f(x)];
  });
  const segments: Point[][] = [];
  let current: Point[] = [];
  samples.forEach((b, i) => {
    const a = samples[i - 1];
    const pole = a !== undefined && ((a[1] > high && b[1] < low) || (a[1] < low && b[1] > high));
    const pair =
      a === undefined || pole || !Number.isFinite(a[1]) || !Number.isFinite(b[1])
        ? null
        : clipPair(a, b, low, high);
    if (pair === null) {
      if (current.length > 0) segments.push(current);
      current = [];
      return;
    }
    const last = current.at(-1);
    if (last === undefined || last[0] !== pair[0][0] || last[1] !== pair[0][1]) {
      if (current.length > 0) segments.push(current);
      current = [pair[0]];
    }
    current.push(pair[1]);
  });
  if (current.length > 0) segments.push(current);
  return segments;
}

export function compileFunction(source: string): (x: number) => number {
  const tree = parseExpression(source);
  return (x) => evaluate(tree, x);
}

const NUMBER = String.raw`-?\d+(?:[.,]\d+)?`;
const RANGE_LINE = new RegExp(
  String.raw`^([xy])\s*[:=]\s*(${NUMBER})\s*(?:\.\.|;|bis|to)\s*(${NUMBER})$`,
  "i",
);

function number(text: string): number {
  return Number(text.replace(",", "."));
}

function lines(text: string): [number, string][] {
  return text
    .split("\n")
    .map((line, index): [number, string] => [index + 1, line.trim()])
    .filter(([, line]) => line !== "");
}

// One function per line ("y =" or "f(x) =" in front is fine); "x: -10..10" and "y: -5..5" set the view.
export function readGraph(text: string, fallback: Range): { functions: string[]; range: Range } {
  const range = [...fallback];
  const functions: string[] = [];
  for (const [line, content] of lines(text)) {
    const bounds = RANGE_LINE.exec(content);
    if (bounds !== null) {
      const [, axis = "x", from = "", to = ""] = bounds;
      const [a, b] = [number(from), number(to)];
      if (!(a < b)) throw new PlotTextError(line, `${axis} range must go from small to large`);
      range.splice(axis.toLowerCase() === "x" ? 0 : 2, 2, a, b);
      continue;
    }
    const source = content.replace(/^(?:y|f\s*\(\s*x\s*\))\s*=\s*/i, "");
    try {
      parseExpression(source);
    } catch (error) {
      if (error instanceof ExpressionError) throw new PlotTextError(line, error.message);
      throw error;
    }
    functions.push(source);
  }
  if (functions.length > MAX_FUNCTIONS) throw new PlotTextError(1, `at most ${MAX_FUNCTIONS} functions`);
  return { functions, range: [range[0] ?? -10, range[1] ?? 10, range[2] ?? -6, range[3] ?? 6] };
}

export function graphText(functions: readonly string[], range: Range): string {
  return [...functions, `x: ${range[0]}..${range[1]}`, `y: ${range[2]}..${range[3]}`].join("\n");
}

// "Label: 12,5", "Label = 12", "Label<Tab>12" or "Label 12": the number at the end of the line is the value.
export function readChart(text: string): { labels: string[]; values: number[] } {
  const labels: string[] = [];
  const values: number[] = [];
  for (const [line, content] of lines(text)) {
    const match = new RegExp(String.raw`^(.*?)[\s:=;]*(${NUMBER})$`).exec(content);
    if (match === null) throw new PlotTextError(line, "expected a label and a number");
    labels.push((match[1] ?? "").trim());
    values.push(number(match[2] ?? ""));
  }
  if (values.length === 0) throw new PlotTextError(1, "no values");
  if (values.length > MAX_VALUES) throw new PlotTextError(MAX_VALUES + 1, `at most ${MAX_VALUES} values`);
  return { labels, values };
}

export function chartText(labels: readonly string[], values: readonly number[]): string {
  return labels.map((label, i) => `${label}: ${values[i] ?? 0}`).join("\n");
}
