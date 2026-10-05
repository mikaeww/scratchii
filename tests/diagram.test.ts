import assert from "node:assert/strict";
import { test } from "node:test";
import { BUILDING_BLOCKS, DIAGRAM_STARTER } from "../src/diagram/blocks.ts";
import { buildDiagram } from "../src/diagram/build.ts";
import { DiagramError, readFlowchart, type Direction, type Flowchart } from "../src/diagram/flowchart.ts";
import { layoutFlowchart } from "../src/diagram/layout.ts";
import { between, pick, seeded, type Random } from "./random.ts";

test("D1: every supported form reads to what it names", () => {
  const chart = readFlowchart(`flowchart LR
    %% a comment
    A[Antrag] --> B{"Prüfen [§ 3]"}
    B -->|ja| C(Rund) --- D((Kreis))
    B -- nein --> E([Stadion]); E -.-> A
    F[[Doppelt<br>zweizeilig]] ==> G
    G === H
    A --- B --> C`);
  assert.equal(chart.direction, "LR");
  assert.deepEqual(
    chart.nodes.map((n) => [n.id, n.label, n.shape]),
    [
      ["A", "Antrag", "box"],
      ["B", "Prüfen [§ 3]", "decision"],
      ["C", "Rund", "round"],
      ["D", "Kreis", "circle"],
      ["E", "Stadion", "round"],
      ["F", "Doppelt\nzweizeilig", "box"],
      ["G", "G", "box"],
      ["H", "H", "box"],
    ],
  );
  assert.deepEqual(
    chart.edges.map((e) => [e.from, e.to, e.label, e.arrow]),
    [
      ["A", "B", "", true],
      ["B", "C", "ja", true],
      ["C", "D", "", false],
      ["B", "E", "nein", true],
      ["E", "A", "", true],
      ["F", "G", "", true],
      ["G", "H", "", false],
      ["A", "B", "", false],
      ["B", "C", "", true],
    ],
  );
  assert.equal(readFlowchart("A --> B").direction, "TD");
  assert.equal(readFlowchart("graph BT\nA --> B").direction, "BT");
  for (const block of [DIAGRAM_STARTER, ...Object.values(BUILDING_BLOCKS)])
    assert.ok(readFlowchart(block).nodes.length > 2);
});

test("D2: unsupported or malformed text fails with its line, nothing else", () => {
  for (const [source, line] of [
    ["A & B --> C", 1],
    ["flowchart TD\nsubgraph X", 2],
    ["A --> B\nC[unclosed", 2],
    ["A -->", 1],
    ["A --> B\n\nflowchart LR", 3],
    ["", 1],
    ["A ~~> B", 1],
  ] as const) {
    assert.throws(
      () => readFlowchart(source),
      (error: unknown) => error instanceof DiagramError && error.line === line,
      source,
    );
  }
  const random = seeded(80);
  const alphabet = [
    "A",
    "B",
    "-->",
    "---",
    "|x|",
    "[",
    "]",
    "(",
    ")",
    "{",
    "}",
    '"',
    ";",
    " ",
    "\n",
    "-- t -->",
    "&",
    "%%",
  ];
  for (let i = 0; i < 2000; i++) {
    const source = Array.from({ length: Math.floor(between(random, 1, 14)) }, () =>
      pick(random, alphabet),
    ).join("");
    try {
      readFlowchart(source);
    } catch (error) {
      assert.ok(error instanceof DiagramError, `case ${i}: ${JSON.stringify(source)}`);
    }
  }
});

function randomChart(random: Random, cycles: boolean): Flowchart {
  const count = 1 + Math.floor(random() * 30);
  const nodes = Array.from({ length: count }, (_, i) => ({
    id: `n${i}`,
    label: `Node ${i}`,
    shape: pick(random, ["box", "round", "circle", "decision"] as const),
  }));
  const edges = Array.from({ length: Math.floor(random() * count * 1.5) }, () => {
    const a = Math.floor(random() * count);
    const b = Math.floor(random() * count);
    // Without cycles every edge points to a later node.
    const [from, to] = cycles || a < b ? [a, b] : [b, a];
    return { from: `n${from}`, to: `n${to}`, label: "", arrow: true };
  }).filter((e) => cycles || e.from !== e.to);
  return { direction: pick(random, ["TD", "BT", "LR", "RL"] as Direction[]), nodes, edges };
}

function checkLayout(chart: Flowchart, random: Random, forward: boolean, i: number): void {
  const sizes = new Map(
    chart.nodes.map((n) => [n.id, { width: between(random, 60, 260), height: between(random, 40, 200) }]),
  );
  const boxes = layoutFlowchart(chart, sizes);
  assert.equal(boxes.size, chart.nodes.length, `case ${i}: a node has no place`);
  const list = [...boxes.values()];
  list.forEach((a, k) => {
    list.slice(k + 1).forEach((b) => {
      const apart =
        a.x + a.width <= b.x + 1e-9 ||
        b.x + b.width <= a.x + 1e-9 ||
        a.y + a.height <= b.y + 1e-9 ||
        b.y + b.height <= a.y + 1e-9;
      assert.ok(apart, `case ${i}: nodes overlap`);
    });
  });
  if (!forward) return;
  const axis = (id: string): number => {
    const box = boxes.get(id);
    if (box === undefined) return NaN;
    return { TD: box.y, BT: -box.y, LR: box.x, RL: -box.x }[chart.direction];
  };
  for (const edge of chart.edges)
    assert.ok(axis(edge.from) < axis(edge.to), `case ${i}: edge ${edge.from}→${edge.to} goes back`);
}

test("D3: acyclic graphs lay out without overlaps, every edge pointing forward", () => {
  const random = seeded(81);
  for (let i = 0; i < 1000; i++) checkLayout(randomChart(random, false), random, true, i);
});

test("D4: graphs with cycles still lay out without overlaps", () => {
  const random = seeded(82);
  for (let i = 0; i < 500; i++) checkLayout(randomChart(random, true), random, false, i);
});

test("D5: building gives one item per node and one attached line per edge", () => {
  const random = seeded(83);
  for (let i = 0; i < 300; i++) {
    const chart = randomChart(random, true);
    const items = buildDiagram(chart, () => ({ width: 120, height: 60 }), {
      color: "ink",
      fill: null,
      size: "m",
    });
    const nodes = items.slice(0, chart.nodes.length);
    const lines = items.slice(chart.nodes.length);
    assert.equal(lines.length, chart.edges.length);
    chart.edges.forEach((edge, k) => {
      const line = lines[k];
      assert.ok(line?.type === "arrow" || line?.type === "line");
      const from = nodes[chart.nodes.findIndex((n) => n.id === edge.from)];
      const to = nodes[chart.nodes.findIndex((n) => n.id === edge.to)];
      assert.deepEqual(line.ends, [from?.id, to?.id], `case ${i}`);
    });
  }
});
