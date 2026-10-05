# Handoff 2026-10-05: study tools

## State

All eight steps of [the study tools plan](../plans/2026-10-05-study-tools.md) are done, committed and pushed
one by one. `npm run check` passes (79 tests). Each step's claims and measured results are in
`docs/verification/study-tools/`; the real checks ran headless (`node tools/render.ts OUT <scene>`, scenes
calc, palette, graphs, tables, connectors, diagrams, templates, squares; `node tools/pdf-check.ts`).

- Calculation: "=" at the end of a line in a text, note or table cell answers maths, conversions and subnets.
- Palette (Ctrl+K or the search button): every tool and command, bilingual search words, arguments.
- Graphs (`graph sin(x); x^2`) and bar or line charts, edited as text with a double-click.
- Tables: Tab and Enter between cells, columns grow to their longest word, right-click for rows, columns and a
  chart; tab-separated paste becomes a table.
- Labels in shapes and on lines; lines drawn from or to an item stay attached and follow it (ADR 0007).
- Diagrams from Mermaid-style flowchart text, building blocks for a procedure, a network, an ER sketch and a
  UML class.
- Templates (Cornell, minutes, cheat sheet, week plan) and paper (plain, dots, squares, lines).
- PDF import, pages as pictures (ADR 0008), pdf.js loaded on the first import only.

## Decisions

- ADR 0007: `label` and `ends` as optional fields; the editor reroutes attached lines in every draft and commit.
- ADR 0008: pdf.js, pinned 6.4.299. Number 0006 was left to the Fold board link plan of another session.
- The palette moved up to step 2, because every later step inserts through it.
- One commit (1a6a794) went in with a failing lint; the next commit (de5fcb9) fixed it. Since then the check
  and the commit run as separate steps.

## Open

- Real use: none of this has been tried by hand with a pen or mouse; the desktop app was not rebuilt.
- Boards with the new item types or fields do not open in older app versions (reported, not guessed).
- Known gaps per component are listed in each verification plan (no subgraphs, straight edges, pages as
  pictures without searchable text, paper is per device).

## Next step

Install the new build on the owner's machine (`./install.sh`, only when asked), then collect what feels wrong in
real use, starting with the palette words and the table editing.
