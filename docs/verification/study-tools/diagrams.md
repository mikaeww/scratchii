# Verification: diagrams from text

Covers `src/diagram/flowchart.ts` (reading Mermaid-style flowchart text), `src/diagram/layout.ts` (layers and
positions) and `src/diagram/build.ts` (items with labels and attached arrows).

## Supported text

- Optional first line `flowchart TD|TB|BT|LR|RL` or `graph …`; top-down when missing.
- Nodes: `A`, `A[box]`, `A[[box]]`, `A(rounded)`, `A([stadium])`, `A((circle))`, `A{decision}`; text in quotes
  may hold brackets; `<br>` breaks a line. Rounded, stadium and circle become ellipses (circle with equal sides),
  a decision becomes a diamond.
- Edges: `-->`, `==>`, `-.->` draw arrows; `---`, `===`, `-.-` draw lines; a label as `-->|text|` or
  `-- text -->`. Chains `A --> B --> C`. Statements end at a line end or `;`. `%%` starts a comment.

## Claims

| # | Claim | Method | Oracle |
|---|---|---|---|
| D1 | Every supported form above reads to the nodes, shapes, labels, edges and edge kinds it names | Example table | The syntax above |
| D2 | Unsupported or malformed text (`A & B`, `subgraph`, an unclosed bracket, an edge without a target, an unknown direction) fails with a `DiagramError` naming its line; nothing is guessed | Example table plus 2000 random lines over the syntax alphabet raising nothing else | Construction |
| D3 | Laid-out nodes never overlap, and in a graph without cycles every edge goes from an earlier layer to a later one in the chosen direction | Property test, 1000 random graphs of 1 to 30 nodes, all four directions | Box arithmetic, the layer of each node |
| D4 | Cycles still lay out: every node gets a place and nothing overlaps | Property test, 500 random graphs with back edges | As D3 |
| D5 | Building gives one item per node and one attached line or arrow per edge, with `ends` naming the node items | Example and property test | The parsed graph |

## Corpus

Random graphs from fixed seeds in `tests/diagram.test.ts`; the building blocks offered in the palette are
parsed in the same test.

## Thresholds

All claims 100 %.

## Results

| Claim | Date | Result |
|---|---|---|
| D1 | 2026-10-05 | every form in one example, plus the starter and all building blocks; "A --- B --> C" first read as an edge labelled "- B", fixed by trying plain edges first |
| D2 | 2026-10-05 | 7 / 7 examples with the right line; 2000 random lines raised nothing but `DiagramError` |
| D3 | 2026-10-05 | 1000 / 1000 graphs |
| D4 | 2026-10-05 | 500 / 500 graphs |
| D5 | 2026-10-05 | 300 / 300 graphs |
| Real app | 2026-10-05 | headless (`node tools/render.ts OUT diagrams`): the dialog's starter (a procedure with a decision, yes/no and a way back) and the network building block, laid out top-down and left-right with attached, labelled arrows. Found on the way: "diagramm aus text" found nothing with the interface in English; the palette now matches every query word against word starts in label and search words |

## Known gaps

- No subgraphs, no `&`, no styles or classes, no sequence or class diagrams; such lines are refused with their
  line number.
- Edges are straight; edges that skip layers may cross nodes in between. Two lines between the same items are
  set apart (K6 in connectors.md), three or more fan out at the same spacing.
- A `;` inside a quoted label splits the statement there.
- Crossings are reduced by two barycenter sweeps, not minimised.
