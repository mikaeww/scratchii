import assert from "node:assert/strict";
import { test } from "node:test";
import type { TableItem } from "../src/model/item.ts";
import {
  cellAt,
  cellBox,
  chartData,
  readTsv,
  relayout,
  withColumn,
  withRow,
  withoutColumn,
  withoutRow,
} from "../src/table/grid.ts";
import { between, randomItem, seeded } from "./random.ts";

const close = (a: number, b: number): boolean => Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(b));

function table(random: () => number): TableItem {
  const item = randomItem(random, "table");
  if (item.type !== "table") throw new Error("invariant: randomItem(table) makes tables");
  return item;
}

test("T-1: cell boxes tile the table exactly in the stored proportions", () => {
  const random = seeded(60);
  for (let i = 0; i < 1000; i++) {
    const t = table(random);
    t.cells.forEach((row, r) => {
      row.forEach((_, c) => {
        const box = cellBox(t, [r, c]);
        assert.ok(close(box.width, (t.columns[c] ?? 0) * t.width), `case ${i}`);
        assert.ok(close(box.height, (t.rows[r] ?? 0) * t.height), `case ${i}`);
        if (c > 0) {
          const left = cellBox(t, [r, c - 1]);
          assert.ok(close(left.x + left.width, box.x), `case ${i}: gap or overlap`);
        }
        if (r > 0) {
          const above = cellBox(t, [r - 1, c]);
          assert.ok(close(above.y + above.height, box.y), `case ${i}: gap or overlap`);
        }
      });
    });
    const last = cellBox(t, [t.cells.length - 1, t.columns.length - 1]);
    assert.ok(
      close(last.x + last.width, t.x + t.width) && close(last.y + last.height, t.y + t.height),
      `case ${i}`,
    );
  }
});

test("T-2: cellAt finds the cell whose box holds the point, and nothing outside", () => {
  const random = seeded(61);
  for (let i = 0; i < 1000; i++) {
    const t = table(random);
    for (let k = 0; k < 50; k++) {
      const point = [
        t.x + between(random, -0.2, 1.2) * t.width,
        t.y + between(random, -0.2, 1.2) * t.height,
      ] as const;
      const cell = cellAt(t, point);
      const inside =
        point[0] >= t.x && point[0] <= t.x + t.width && point[1] >= t.y && point[1] <= t.y + t.height;
      if (!inside) {
        assert.equal(cell, null, `case ${i}`);
        continue;
      }
      assert.ok(cell !== null, `case ${i}`);
      const box = cellBox(t, cell);
      const slack = 1e-6 * Math.max(t.width, t.height);
      assert.ok(point[0] >= box.x - slack && point[0] <= box.x + box.width + slack, `case ${i}`);
      assert.ok(point[1] >= box.y - slack && point[1] <= box.y + box.height + slack, `case ${i}`);
    }
  }
});

test("T-3: adding and removing rows and columns keeps every other cell in place", () => {
  const random = seeded(62);
  const sum = (fractions: readonly number[]): number => fractions.reduce((a, b) => a + b, 0);
  for (let i = 0; i < 1000; i++) {
    const t = table(random);
    const [rows, columns] = [t.cells.length, t.columns.length];
    const r = Math.floor(random() * (rows + 1));
    const c = Math.floor(random() * (columns + 1));
    const added = withRow(withColumn(t, c), r);
    assert.equal(added.cells.length, rows + 1);
    t.cells.forEach((row, ri) => {
      row.forEach((text, ci) => {
        assert.equal(added.cells[ri >= r ? ri + 1 : ri]?.[ci >= c ? ci + 1 : ci], text, `case ${i}`);
      });
    });
    assert.ok(close(sum(added.rows), 1) && close(sum(added.columns), 1), `case ${i}`);
    const back = withoutColumn(withoutRow(added, r), c);
    assert.deepEqual(back.cells, t.cells, `case ${i}`);
    assert.ok(close(sum(back.rows), 1) && close(sum(back.columns), 1), `case ${i}`);
  }
});

test("T-4: relayout widens columns to their longest word, grows rows to their tallest cell, never shrinks", () => {
  const random = seeded(63);
  const measure = {
    lines: (text: string, width: number): number =>
      Math.max(1, Math.ceil((text.length * 9) / Math.max(1, width))),
    longestWord: (text: string): number => Math.max(0, ...text.split(/\s+/).map((word) => word.length * 9)),
  };
  for (let i = 0; i < 1000; i++) {
    const t = table(random);
    const out = relayout(t, 20, measure);
    const sum = (fractions: readonly number[]): number => fractions.reduce((a, b) => a + b, 0);
    assert.ok(close(sum(out.rows), 1) && close(sum(out.columns), 1), `case ${i}`);
    const width = (c: number): number => (out.columns[c] ?? 0) * out.width;
    t.columns.forEach((fraction, c) => {
      assert.ok(width(c) >= fraction * t.width - 1e-6, `case ${i}: column ${c} shrank`);
    });
    t.cells.forEach((row, r) => {
      const height = (out.rows[r] ?? 0) * out.height;
      assert.ok(height >= (t.rows[r] ?? 0) * t.height - 1e-6, `case ${i}: row ${r} shrank`);
      row.forEach((text, c) => {
        assert.ok(
          width(c) >= measure.longestWord(text) + 16 - 1e-6,
          `case ${i}: word wider than column ${c}`,
        );
        assert.ok(
          height >= measure.lines(text, width(c) - 16) * 20 + 16 - 1e-6,
          `case ${i}: row ${r} too short`,
        );
      });
    });
  }
});

test("T-5: tab-separated text becomes exactly that grid; other text is no table", () => {
  assert.deepEqual(readTsv("Fach\tNote\nMathe\t1,7\nBWL\t2,3\n"), [
    ["Fach", "Note"],
    ["Mathe", "1,7"],
    ["BWL", "2,3"],
  ]);
  assert.deepEqual(readTsv("a\tb\tc\r\nd\r\n"), [
    ["a", "b", "c"],
    ["d", "", ""],
  ]);
  assert.equal(readTsv("just a line"), null);
  assert.equal(readTsv("a\nb"), null);
  const random = seeded(64);
  for (let i = 0; i < 500; i++) {
    const grid = Array.from({ length: 1 + Math.floor(random() * 10) }, () =>
      Array.from({ length: 2 + Math.floor(random() * 6) }, () =>
        random() < 0.2 ? "" : `x${Math.floor(random() * 99)}`,
      ),
    );
    const width = Math.max(...grid.map((row) => row.length));
    const padded = grid.map((row) => [...row, ...Array.from({ length: width - row.length }, () => "")]);
    assert.deepEqual(readTsv(grid.map((row) => row.join("\t")).join("\n")), padded, `case ${i}`);
  }
});

test("T-6: a chart takes labels from the first column and the first numeric column, skipping a header", () => {
  assert.deepEqual(
    chartData([
      ["Posten", "Notiz", "Betrag"],
      ["Miete", "warm", "450"],
      ["Strom", "", "62,5 €"],
      ["Summe", "", ""],
    ]),
    { labels: ["Miete", "Strom"], values: [450, 62.5] },
  );
  assert.deepEqual(
    chartData([
      ["A", "1"],
      ["B", "2"],
    ]),
    { labels: ["A", "B"], values: [1, 2] },
  );
  assert.equal(
    chartData([
      ["Name", "Text"],
      ["x", "y"],
    ]),
    null,
  );
});
