// Structure check: the file, directory and naming limits of docs/conventions.md over every handwritten file.
// Function size and parameter count are eslint's and clippy's job, not this tool's.
// Usage: node tools/structure.ts [ROOT]   prints violations and coverage, exits 1 on any violation.
import { lstatSync, readdirSync, readFileSync } from "node:fs";
import { extname, join, relative, sep } from "node:path";

export const MAX_FILE_LINES = 500;
export const MAX_CODE_FILES = 8;
export const MAX_DOC_FILES = 8;
export const MAX_SRC_DEPTH = 4;
const CODE = new Set([".ts", ".js", ".css", ".html", ".rs", ".sh"]);
const SKIP = new Set([".git", "node_modules", "dist", "target", "gen", "public"]);
const ENTRY = new Set(["index.ts", "main.ts", "main.rs", "lib.rs", "mod.rs"]);
const FORBIDDEN = new Set(["utils", "util", "helpers", "helper", "misc", "common", "stuff", "shared"]);

export interface Report {
  problems: string[];
  coverage: Map<string, number>;
}

type Kind = "code" | "doc" | null;

function kindOf(path: string): Kind {
  const extension = extname(path);
  if (CODE.has(extension)) return "code";
  return extension === ".md" ? "doc" : null;
}

function isTest(name: string): boolean {
  return name.endsWith(".test.ts");
}

function checkDirectory(parts: string[], files: string[]): string[] {
  const problems: string[] = [];
  const label = parts.join("/") || ".";
  const name = parts.at(-1);
  if (name !== undefined && FORBIDDEN.has(name)) problems.push(`${label}: forbidden directory name`);
  const code = files.filter((f) => kindOf(f) === "code" && !ENTRY.has(f) && !isTest(f));
  if (parts[0] !== "tests" && code.length > MAX_CODE_FILES) {
    problems.push(`${label}: ${code.length} code files (max ${MAX_CODE_FILES})`);
  }
  const docs = files.filter((f) => kindOf(f) === "doc");
  if (parts[0] === "docs" && docs.length > MAX_DOC_FILES) {
    problems.push(`${label}: ${docs.length} markdown files (max ${MAX_DOC_FILES})`);
  }
  if (parts[0] === "src" && parts.length - 1 > MAX_SRC_DEPTH) {
    problems.push(`${label}: deeper than ${MAX_SRC_DEPTH} below src/`);
  }
  return problems;
}

function checkFile(path: string, label: string, coverage: Map<string, number>): string[] {
  const kind = kindOf(path);
  if (kind === null) return [];
  const extension = extname(path);
  coverage.set(extension, (coverage.get(extension) ?? 0) + 1);
  const problems: string[] = [];
  const lines = readFileSync(path, "utf8").split("\n").length - 1;
  if (lines > MAX_FILE_LINES) problems.push(`${label}: ${lines} lines (max ${MAX_FILE_LINES})`);
  const stem = label.split("/").at(-1)?.split(".")[0] ?? "";
  if (kind === "code" && FORBIDDEN.has(stem)) problems.push(`${label}: forbidden module name`);
  return problems;
}

function walk(root: string, directory: string, report: Report): void {
  const entries = readdirSync(directory, { withFileTypes: true }).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  const parts = relative(root, directory).split(sep).filter(Boolean);
  const files = entries.filter((e) => e.isFile()).map((e) => e.name);
  report.problems.push(...checkDirectory(parts, files));
  for (const name of files) {
    report.problems.push(...checkFile(join(directory, name), [...parts, name].join("/"), report.coverage));
  }
  for (const entry of entries) {
    const path = join(directory, entry.name);
    // Symlinks are never followed: they could leave the project or loop.
    if (entry.isDirectory() && !SKIP.has(entry.name) && !lstatSync(path).isSymbolicLink()) {
      walk(root, path, report);
    }
  }
}

export function scan(root: string): Report {
  const report: Report = { problems: [], coverage: new Map() };
  walk(root, root, report);
  return report;
}

if (import.meta.main) {
  const report = scan(process.argv[2] ?? join(import.meta.dirname, ".."));
  for (const problem of report.problems) console.log(problem);
  const covered = [...report.coverage].map(([extension, count]) => `${count} ${extension}`).join(", ");
  console.log(`structure: ${report.problems.length} violations in ${covered}; function limits are eslint's`);
  process.exitCode = report.problems.length > 0 ? 1 : 0;
}
