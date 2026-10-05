# Verification: command palette

Covers `src/ui/palette/rank.ts` (which commands fit a query, and its argument) and the palette dialog.

## Claims

| # | Claim | Method | Oracle |
|---|---|---|---|
| P1 | An empty query lists every command in the given order | Example test | Construction |
| P2 | A command that takes an argument, followed by a space and text, is ranked first and gets the rest of the query as argument with its case kept | Example tests (`tests/palette.test.ts`) | Construction |
| P3 | Exact names and prefixes rank above word prefixes, substrings and scattered letters; queries that fit nothing return nothing | Example tests | Construction |
| P4 | Ctrl+K opens the palette in the running app, typing filters it, Enter runs the highlighted command | Headless render (`node tools/render.ts OUT palette`) | The screenshot |

## Corpus

The examples in `tests/palette.test.ts`; the real command list is built from the interface text.

## Thresholds

All claims hold.

## Results

| Claim | Date | Result |
|---|---|---|
| P1 to P3 | 2026-10-05 | pass |
| P4 | 2026-10-05 | headless: Ctrl+K opened the palette, `kre` showed the ellipse first (German search word "kreis") |

## Known gaps

- Ranking is a fixed scoring, not learned from use; recently used commands are not moved up.
