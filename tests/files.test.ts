import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { createBoard, putItems } from "../src/model/board.ts";
import { parseFile, serialiseFile } from "../src/model/file.ts";
import { COLORS, type Color } from "../src/model/item.ts";
import { ValidationError } from "../src/model/validate.ts";
import { pdfFromJpeg } from "../src/render/export/pdf.ts";
import { svgDocument } from "../src/render/export/svg.ts";
import { paintOrder } from "../src/render/order.ts";
import { importAs, search, summarise } from "../src/storage/library.ts";
import { pick, randomBoard, randomItem, seeded } from "./random.ts";

const scratch = mkdtempSync(join(tmpdir(), "scratchii-files-"));
after(() => {
  rmSync(scratch, { recursive: true });
});

function run(command: string, args: string[]): string {
  const result = spawnSync(command, args, { encoding: "utf8" });
  if (result.error !== undefined)
    throw new Error(`${command} is required for this check: ${result.error.message}`);
  assert.equal(result.status, 0, `${command} ${args.join(" ")}\n${result.stdout}${result.stderr}`);
  return result.stdout + result.stderr;
}

test("F1: files round-trip every generated board", () => {
  const random = seeded(40);
  for (let i = 0; i < 500; i++) {
    const board = randomBoard(random);
    assert.deepStrictEqual(parseFile(serialiseFile(board)), board, `case ${i}`);
  }
});

test("F2: foreign, future, broken and invalid files are rejected with the place of the problem", () => {
  const board = createBoard("x");
  const cases: [string, string][] = [
    ["{", "file"],
    [JSON.stringify({ format: "excalidraw", version: 1, board }), "file.format"],
    [JSON.stringify({ format: "scratchii", version: 2, board }), "file.version"],
    [JSON.stringify({ format: "scratchii", version: 1, board, extra: 1 }), "file.extra"],
    [JSON.stringify({ format: "scratchii", version: 1, board: { ...board, title: 3 } }), "file.board.title"],
  ];
  for (const [text, path] of cases) {
    assert.throws(
      () => parseFile(text),
      (error: unknown) => error instanceof ValidationError && error.path === path,
      path,
    );
  }
});

test("F3: the PDF writer produces a valid one-page PDF of the requested page size", () => {
  const jpeg = readFileSync(join(import.meta.dirname, "fixtures", "pixel.jpg"));
  for (const [width, height] of [
    [8, 6],
    [800, 600],
    [1, 1],
  ] as const) {
    const path = join(scratch, `page-${width}.pdf`);
    writeFileSync(path, pdfFromJpeg(jpeg, { width: 8, height: 6 }, { width, height }));
    // qpdf exits 2 on errors and 3 on warnings; run() asserts exit 0.
    run("qpdf", ["--check", path]);
    const info = run("pdfinfo", [path]);
    assert.match(info, /Pages:\s+1\n/);
    assert.match(
      info,
      new RegExp(
        `Page size:\\s+${(width * 0.75).toFixed(2).replace(/\.?0+$/, "")} x ${(height * 0.75).toFixed(2).replace(/\.?0+$/, "")} pts`,
      ),
    );
  }
});

// Labels measure their text; Node has no canvas, so a stand-in measures 10 units per character.
class TextMeasureStandIn {
  getContext(): { font: string; measureText: (text: string) => { width: number } } {
    return { font: "", measureText: (text) => ({ width: text.length * 10 }) };
  }
}
(globalThis as { OffscreenCanvas?: unknown }).OffscreenCanvas ??= TextMeasureStandIn;

test("F4: SVG export is well-formed, renders elsewhere and has one path per path operation", () => {
  const random = seeded(41);
  const colors = Object.fromEntries(COLORS.map((c) => [c, "#123456"])) as Record<Color, string>;
  const style = { colors, background: "#ffffff", shadow: [6, 6] as const, fontFace: "" };
  for (let i = 0; i < 200; i++) {
    const items = Array.from({ length: 1 + Math.floor(random() * 6) }, () =>
      randomItem(random, pick(random, ["stroke", "rect", "ellipse", "line", "arrow"] as const)),
    );
    const steps = paintOrder(items);
    const view = { x: -10, y: -20, width: 300, height: 200 };
    const svg = svgDocument(steps, view, style);
    const path = join(scratch, `board-${i}.svg`);
    writeFileSync(path, svg);
    run("xmllint", ["--noout", path]);
    if (i % 20 === 0) run("rsvg-convert", ["-o", join(scratch, `board-${i}.png`), path]);
    const expected = steps
      .flatMap((s) => s.ops)
      .reduce((n, op) => n + (op.kind === "path" ? (op.shadow ? 2 : 1) : 0), 0);
    assert.equal(svg.match(/<path /g)?.length ?? 0, expected, `case ${i}`);
    assert.ok(svg.includes(`viewBox="-10 -20 300 200"`));
  }
});

test("F5: search matches title, tags and live text, case-insensitively", () => {
  const random = seeded(42);
  const words = ["Plan", "groceries", "Paint", "idea", "zzz"];
  for (let i = 0; i < 500; i++) {
    const text = randomItem(random, "text");
    const deleted = { ...randomItem(random, "note"), deleted: true };
    const board = {
      ...putItems(randomBoard(random), [
        { ...text, text: pick(random, words) } as never,
        { ...deleted, text: "hidden" } as never,
      ]),
      title: pick(random, words),
      tags: [pick(random, words)],
    };
    const summary = summarise(board);
    for (const query of [...words, "hidden"].map((w) => (random() < 0.5 ? w.toUpperCase() : ` ${w} `))) {
      const needle = query.trim().toLowerCase();
      const live = board.items
        .filter((item) => !item.deleted && (item.type === "text" || item.type === "note"))
        .map((item) => ("text" in item ? item.text : ""));
      const expected = [board.title, ...board.tags, ...live].some((value) =>
        value.toLowerCase().includes(needle),
      );
      assert.equal(search([summary], query).length === 1, expected, `case ${i} "${query}"`);
    }
  }
});

test("F6: importing a board with a taken id makes a copy and keeps free ids", () => {
  const board = createBoard("x");
  assert.equal(importAs(board, new Set()).id, board.id);
  const copy = importAs(board, new Set([board.id]));
  assert.notEqual(copy.id, board.id);
  assert.deepEqual({ ...copy, id: board.id }, board);
});
