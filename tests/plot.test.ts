import assert from "node:assert/strict";
import { test } from "node:test";
import {
  PlotTextError,
  chartText,
  graphText,
  niceTicks,
  plotSegments,
  readChart,
  readGraph,
  type Range,
} from "../src/calc/plot.ts";
import { between, pick, seeded, type Random } from "./random.ts";

test("G-1: ticks are 2 to 12 even steps of 1, 2 or 5 x 10^k inside the range", () => {
  const random = seeded(50);
  for (let i = 0; i < 2000; i++) {
    const scale = 10 ** Math.floor(between(random, -6, 6));
    const min = between(random, -100, 100) * scale;
    const max = min + between(random, 0.5, 100) * scale;
    const ticks = niceTicks(min, max);
    assert.ok(ticks.length >= 2 && ticks.length <= 12, `case ${i}: ${ticks.length} ticks`);
    const step = (ticks[1] ?? 0) - (ticks[0] ?? 0);
    const mantissa = step / 10 ** Math.floor(Math.log10(step));
    assert.ok(
      [1, 2, 5, 10].some((m) => Math.abs(mantissa - m) < 1e-6),
      `case ${i}: step ${step}`,
    );
    ticks.forEach((tick, k) => {
      assert.ok(tick >= min - step * 1e-6 && tick <= max + step * 1e-6, `case ${i}: ${tick} outside`);
      if (k > 0) assert.ok(Math.abs(tick - (ticks[k - 1] ?? 0) - step) < step * 1e-6, `case ${i}: uneven`);
    });
  }
});

function randomFunction(random: Random): (x: number) => number {
  const [a, b, c] = [between(random, -5, 5), between(random, -3, 3), between(random, -5, 5)];
  return pick(random, [
    (x: number) => a * Math.sin(b * x) + c,
    (x: number) => a * x * x + b * x + c,
    (x: number) => a / (x - c),
    (x: number) => Math.tan(b * x),
    (x: number) => Math.sqrt(x - c),
    (x: number) => Math.exp(b * x) + c,
  ]);
}

function randomRange(random: Random): Range {
  const x = between(random, -20, 10);
  const y = between(random, -20, 10);
  return [x, x + between(random, 0.5, 30), y, y + between(random, 0.5, 30)];
}

test("G-2: plotted points stay in the view, and samples inside it are drawn", () => {
  const random = seeded(51);
  for (let i = 0; i < 300; i++) {
    const f = randomFunction(random);
    const range = randomRange(random);
    const [xMin, xMax, yMin, yMax] = range;
    const segments = plotSegments(f, range);
    const drawn = new Set(segments.flat().map(([x, y]) => `${x},${y}`));
    for (const [x, y] of segments.flat()) {
      assert.ok(x >= xMin - 1e-9 && x <= xMax + 1e-9 && y >= yMin - 1e-9 && y <= yMax + 1e-9, `case ${i}`);
    }
    for (let k = 1; k <= 400; k++) {
      const [xa, xb] = [xMin + ((xMax - xMin) * (k - 1)) / 400, xMin + ((xMax - xMin) * k) / 400];
      const [ya, yb] = [f(xa), f(xb)];
      const inside = (y: number): boolean => Number.isFinite(y) && y >= yMin && y <= yMax;
      if (inside(ya) && inside(yb))
        assert.ok(drawn.has(`${xa},${ya}`) && drawn.has(`${xb},${yb}`), `case ${i}`);
    }
  }
});

test("G-3: poles split the curve instead of drawing through the view", () => {
  for (const [f, pole] of [
    [(x: number) => 1 / x, 0],
    [Math.tan, Math.PI / 2],
  ] as const) {
    const segments = plotSegments(f, [-3, 3, -5, 5]);
    for (const segment of segments) {
      const xs = segment.map(([x]) => x);
      assert.ok(Math.max(...xs) <= pole || Math.min(...xs) >= pole, "a segment crosses the pole");
    }
    assert.ok(segments.length >= 2);
  }
});

test("G-4: graph and chart text round-trips", () => {
  const random = seeded(52);
  for (let i = 0; i < 500; i++) {
    const functions = Array.from({ length: 1 + Math.floor(random() * 6) }, () =>
      pick(random, ["sin(x)", "x^2 - 3", "2x + 1", "sqrt(x)"]),
    );
    const range: Range = [-Math.floor(between(random, 1, 50)), Math.floor(between(random, 1, 50)), -2.5, 7.5];
    assert.deepEqual(readGraph(graphText(functions, range), [-1, 1, -1, 1]), { functions, range });
    const count = 1 + Math.floor(random() * 40);
    const labels = Array.from({ length: count }, (_, k) => `Posten ${k}`);
    const values = Array.from({ length: count }, () => Math.round(between(random, -1e4, 1e4) * 100) / 100);
    assert.deepEqual(readChart(chartText(labels, values)), { labels, values });
  }
  assert.deepEqual(readChart("Miete: 450\nStrom 62,5\nQ3 2025 = -12"), {
    labels: ["Miete", "Strom", "Q3 2025"],
    values: [450, 62.5, -12],
  });
  assert.deepEqual(readGraph("y = x^2\nf(x) = sin x\nx: -5 bis 5", [-1, 1, -2, 2]), {
    functions: ["x^2", "sin x"],
    range: [-5, 5, -2, 2],
  });
});

test("G-5: malformed edit text fails with its line", () => {
  const fallback: Range = [-10, 10, -6, 6];
  for (const [read, input, line] of [
    [() => readGraph("sin(x)\nfoo(x)", fallback), "", 2],
    [() => readGraph("x: 5..1", fallback), "", 1],
    [() => readGraph(Array.from({ length: 7 }, () => "x").join("\n"), fallback), "", 1],
    [() => readChart("A: 1\nB"), "", 2],
    [() => readChart(""), "", 1],
    [() => readChart(Array.from({ length: 41 }, (_, k) => `L ${k}`).join("\n")), "", 41],
  ] as const) {
    assert.throws(read, (error: unknown) => error instanceof PlotTextError && error.line === line, input);
  }
});
