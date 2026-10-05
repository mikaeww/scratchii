import assert from "node:assert/strict";
import { test } from "node:test";
import { rankCommands, type Command } from "../src/ui/palette/rank.ts";

function command(id: string, label: string, words: string[], argument?: string): Command {
  return { id, label, words, ...(argument === undefined ? {} : { argument }), run: () => {} };
}

const COMMANDS = [
  command("pen", "Pen (P)", ["stift", "pen"]),
  command("table", "Table", ["tabelle", "table"], "3x4"),
  command("graph", "Function graph", ["graph", "plot", "funktion"], "sin(x)"),
  command("rect", "Box (R)", ["rechteck", "kasten"]),
];

test("P1: an empty query lists every command in order", () => {
  assert.deepEqual(
    rankCommands("  ", COMMANDS).map((m) => m.command.id),
    ["pen", "table", "graph", "rect"],
  );
});

test("P2: a command name followed by text passes the text as argument, case kept", () => {
  const [first] = rankCommands("Tabelle 3x4", COMMANDS);
  assert.equal(first?.command.id, "table");
  assert.equal(first.argument, "3x4");
  const [graph] = rankCommands("plot sin(X) + 1", COMMANDS);
  assert.equal(graph?.command.id, "graph");
  assert.equal(graph.argument, "sin(X) + 1");
});

test("P3: prefixes beat substrings, substrings beat scattered letters, misses are left out", () => {
  assert.equal(rankCommands("sti", COMMANDS)[0]?.command.id, "pen");
  assert.equal(rankCommands("kast", COMMANDS)[0]?.command.id, "rect");
  assert.equal(rankCommands("tbl", COMMANDS)[0]?.command.id, "table");
  assert.deepEqual(rankCommands("zzz", COMMANDS), []);
});
