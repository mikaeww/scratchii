# Plan 2026-10-05: study tools

Five additions for university work in IT and public administration, asked for by the owner on 2026-10-05:
PDF import, connectors and diagrams from text, calculation and graphs, tables, and a command palette with
templates. Each one lands as its own commit with its checks; the order below keeps the tree working.

## Outcome

What works when this plan is done:

1. **Calculation.** Typing `=` at the end of a line in a text or note puts the result after it: arithmetic with
   powers, roots, trigonometry, logarithms, factorials, hex `0x`, binary `0b` and octal `0o` numbers,
   `… in hex|bin|oct|dec` conversions, and IPv4 subnets (`192.168.1.0/26 =` gives network, broadcast, mask and
   hosts). An expression that cannot be read says why instead of guessing.
2. **Graphs and charts.** A graph item plots up to six functions of `x` over a chosen range, with axes, ticks
   and a legend; double-click edits the functions and the range. A chart item draws bars or a line from
   labelled values; it is created from a table (right-click) or from the palette and edited the same way.
3. **Tables.** A table item with editable cells: double-click a cell to type, Tab and Enter move between cells,
   Tab in the last cell adds a row, right-click adds or removes rows and columns. Pasting tab-separated text
   (Excel, LibreOffice) creates a table. Row heights follow the text.
4. **Connectors and labels.** Boxes, ellipses and polygons carry a centred label; lines and arrows carry a
   label at their middle. A line or arrow drawn from or to an item attaches to it and follows it when the item
   moves, resizes or is undone; deleting the item detaches the end where it is.
5. **Diagrams from text.** A dialog takes Mermaid-style flowchart text (`flowchart LR`, `A[Antrag] --> B{Prüfen}`,
   `B -->|ja| C`) and builds labelled shapes joined by attached arrows, laid out in layers. Building blocks
   (network, administrative procedure, UML class, ER sketch) insert ready-made diagram text. Errors name the
   line.
6. **Command palette and templates.** Ctrl+K opens a palette: type to filter tools and commands, with
   arguments (`tabelle 3x4`, `graph sin(x)`). Templates insert Cornell notes, minutes, a cheat sheet and a week
   plan; the paper background can be dots, squares or lines.
7. **PDF import.** Dropping or choosing a PDF places its pages as pictures, one under the other, ready to be
   written on. More than 60 pages: the first 60 are placed and a notice says so.

Not in this plan: live links between a table and its chart, sequence diagrams, handwritten maths, audio.

## Implementation

| Step | Code | Notes |
|---|---|---|
| 1 | `src/calc/` expression parser and evaluator, subnet, conversions; `=` in the text editor | No dependency |
| 2 | `src/ui/palette/`: Ctrl+K, ranking with arguments, tool commands; later steps add theirs | Moved up: every later step needs a way to insert its items |
| 3 | `graph` and `chart` items, `src/calc/plot.ts` (sampling, ticks), `src/render/charts.ts`, edit dialog | |
| 4 | `table` item, `src/table/` (layout, cell hit, TSV), cell editing in the text editor, menu entries | |
| 5 | `label` on shapes, polygons and lines, `ends` on lines, `src/diagram/connect.ts`; the editor reroutes attached lines on every draft and commit | ADR 0007 |
| 6 | `src/diagram/flowchart.ts` (parser), `layout.ts`, `build.ts`, dialog and building blocks | |
| 7 | `src/templates/`, paper backgrounds in preferences and settings | |
| 8 | `src/import/pdf.ts` with pdf.js, loaded only when a PDF arrives | ADR 0008 (0006 is taken by the Fold board link plan) |

The item model grows by `table`, `graph` and `chart`, and by the fields `label` and `ends` (ADR 0007). Files
written before keep loading: the new fields are optional when read and default to empty.

Verification plans live in [`../verification/study-tools/`](../verification/study-tools/), one per component,
written before the code of that step.

## Risks

- Every new item type has to reach bounds, hits, scaling, rendering, export, validation and the random items
  of the property tests; the type checker lists every switch that misses one.
- Older app versions refuse boards with the new types (unknown type, reported with its path).
- pdf.js is large; it is loaded only on demand so start-up stays as fast as before.
- The toolbar does not grow: tables, graphs, charts, diagrams and templates are reached through the palette and
  the context menu.
