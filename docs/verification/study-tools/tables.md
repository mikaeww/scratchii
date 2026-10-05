# Verification: tables

Covers `src/table/grid.ts` (cell boxes, the cell under a point, adding and removing rows and columns, row
heights from the text, tab-separated text, a chart from a table), the `table` item and its cell editing.

## Claims

| # | Claim | Method | Oracle |
|---|---|---|---|
| T-1 | The cell boxes of a table tile its box exactly: no gaps, no overlaps, widths and heights in the stored proportions | Property test, 1000 random tables | Arithmetic on the fractions |
| T-2 | `cellAt` returns the cell whose box contains the point, for every point inside the table, and null outside | Property test, 1000 tables × 50 points | T-1's boxes |
| T-3 | Adding a row or column keeps every existing cell's text at its row and column (shifted past the insert), removing one drops exactly that row or column; fractions still sum to 1 | Property test, 1000 random edits | The cell grid edited directly |
| T-4 | After a relayout every row is at least as tall as its tallest cell needs and never shorter than before; the table height is the sum of the rows | Property test with a fake line counter | The line counter |
| T-5 | Tab-separated text with at least two cells becomes exactly that grid (rows by newline, cells by tab, ragged rows padded with empty cells); other text is no table | Example and property tests | Splitting by hand |
| T-6 | A chart from a table takes labels from the first column and values from the first column with numbers (decimal comma allowed), skipping a header row | Example tests | Construction |
| T-7 | Tables survive validation, files, moving and scaling like every other item | The existing property tests with tables in `tests/random.ts` | The model claims |

## Corpus

Random tables from fixed seeds: 1 to 12 rows, 1 to 8 columns, short random cell texts.

## Thresholds

All claims 100 %.

## Results

| Claim | Date | Result |
|---|---|---|
| T-1 | 2026-10-05 | 1000 / 1000 tables |
| T-2 | 2026-10-05 | 50 000 / 50 000 points |
| T-3 | 2026-10-05 | 1000 / 1000 edits, removing what was added gives back the same grid |
| T-4 | 2026-10-05 | 1000 / 1000. First run of the column part failed on rounding: a column exactly as wide as its word came back a hair narrower from its fraction; 1 unit of slack added |
| T-5 | 2026-10-05 | 4 examples, 500 / 500 random grids |
| T-6 | 2026-10-05 | 3 / 3 examples |
| T-7 | 2026-10-05 | the geometry, file and sync property tests pass with tables among the random items |
| Real app | 2026-10-05 | headless (`node tools/render.ts OUT tables`): a 4 × 3 table from the palette filled with Tab (Tab in the last cell added a row), the "Netzwerktechnik" column widened to fit, a bar chart from the right-click menu, a pasted three-column block became a table with wrapped rows |

## Known gaps

- No formulas in cells; a cell ending in "=" gets its answer like any text.
- Columns are set by resizing the whole table or grow to their longest word; one column cannot be dragged on its own.
- Scaling a table down does not shrink its text; the rows grow back to fit on the next edit.
