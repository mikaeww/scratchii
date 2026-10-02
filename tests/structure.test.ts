import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { MAX_CODE_FILES, MAX_FILE_LINES, scan } from "../tools/structure.ts";

const root = mkdtempSync(join(tmpdir(), "scratchii-structure-"));
after(() => {
  rmSync(root, { recursive: true });
});

function project(name: string, files: Record<string, string>): string {
  const base = join(root, name);
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(join(base, path, ".."), { recursive: true });
    writeFileSync(join(base, path), content);
  }
  return base;
}

test("a clean project has no problems and reports its coverage", () => {
  const base = project("clean", { "src/model/board.ts": "x\n", "docs/README.md": "# a\n" });
  const report = scan(base);
  assert.deepEqual(report.problems, []);
  assert.equal(report.coverage.get(".ts"), 1);
  assert.equal(report.coverage.get(".md"), 1);
});

test("too many lines, too many files and forbidden names are reported", () => {
  const files: Record<string, string> = { "src/a/long.ts": "x\n".repeat(MAX_FILE_LINES + 1) };
  for (let i = 0; i <= MAX_CODE_FILES; i++) files[`src/wide/f${i}.ts`] = "";
  files["src/wide/index.ts"] = "";
  files["src/utils/x.ts"] = "";
  files["src/b/helpers.ts"] = "";
  const problems = scan(project("broken", files)).problems;
  assert.deepEqual(problems, [
    "src/a/long.ts: 501 lines (max 500)",
    "src/b/helpers.ts: forbidden module name",
    "src/utils: forbidden directory name",
    "src/wide: 9 code files (max 8)",
  ]);
});

test("entry files and tests do not count towards the width, depth and docs are limited", () => {
  const files: Record<string, string> = { "src/a/b/c/d/e/deep.ts": "" };
  for (let i = 0; i < MAX_CODE_FILES; i++) files[`src/ok/f${i}.ts`] = "";
  files["src/ok/index.ts"] = "";
  files["src/ok/f0.test.ts"] = "";
  for (let i = 0; i < 9; i++) files[`docs/plans/p${i}.md`] = "";
  const problems = scan(project("limits", files)).problems;
  assert.deepEqual(problems, [
    "docs/plans: 9 markdown files (max 8)",
    "src/a/b/c/d/e: deeper than 4 below src/",
  ]);
});

test("skipped directories and symlinks are not entered", () => {
  const elsewhere = project("elsewhere", { "long.ts": "x\n".repeat(MAX_FILE_LINES + 1) });
  const base = project("skips", { "node_modules/x/utils.ts": "" });
  symlinkSync(elsewhere, join(base, "linked"));
  assert.deepEqual(scan(base).problems, []);
});
