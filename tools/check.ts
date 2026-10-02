// The one check command: formatter, linter, types, structure, tests, and the Rust shell once it exists.
// Stops at the first failure. Runs at the lowest CPU and I/O priority because the owner works in parallel.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { availableParallelism } from "node:os";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const jobs = String(Math.max(1, Math.floor(availableParallelism() / 3)));
const bin = (name: string): string => join(root, "node_modules", ".bin", name);

const steps: [string, string[]][] = [
  ["format", [bin("prettier"), "--check", "--log-level", "warn", "."]],
  ["lint", [bin("eslint"), "--max-warnings", "0", "."]],
  ["types", [bin("tsc"), "--noEmit", "-p", "."]],
  ["structure", [process.execPath, "tools/structure.ts"]],
  ["tests", [process.execPath, "--test", `--test-concurrency=${jobs}`, "tests/**/*.test.ts"]],
];
if (existsSync(join(root, "src-tauri", "Cargo.toml"))) {
  const manifest = ["--manifest-path", "src-tauri/Cargo.toml"];
  steps.push(["rust format", ["cargo", "fmt", ...manifest, "--check"]]);
  steps.push(["rust lint", ["cargo", "clippy", ...manifest, "-j", jobs, "--locked", "--", "-D", "warnings"]]);
}

for (const [name, command] of steps) {
  const started = performance.now();
  const result = spawnSync("nice", ["-n", "19", "ionice", "-c", "3", ...command], {
    cwd: root,
    stdio: "inherit",
  });
  const seconds = ((performance.now() - started) / 1000).toFixed(1);
  if (result.error !== undefined || result.status !== 0) {
    console.error(`check: ${name} failed after ${seconds}s`);
    process.exit(1);
  }
  console.log(`check: ${name} ok (${seconds}s)`);
}
console.log("check: all passed");
