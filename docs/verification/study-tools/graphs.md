# Verification: graphs and charts

Covers `src/calc/plot.ts` (ticks, sampling and clipping a function, reading the edit text of graphs and charts),
the `graph` and `chart` items and their drawing in `src/render/charts.ts`.

## Claims

| # | Claim | Method | Oracle |
|---|---|---|---|
| G-1 | `niceTicks(min, max)` returns 2 to 12 ascending values inside [min, max], evenly spaced by 1, 2 or 5 × 10^k | Property test, 2000 random ranges over 12 orders of magnitude | Construction |
| G-2 | Every point of every plotted segment lies inside the view (x and y within the range, 1e-9 slack), and every sample of the function that is finite and inside the view lies on a segment | Property test, 300 random functions × random views | Direct evaluation of the function |
| G-3 | A function that jumps from far above to far below the view between two samples (tan, 1/x) is split there instead of drawing a vertical line through the view | Example tests | Known asymptotes |
| G-4 | `readGraph(graphText(item))` gives back the item's functions and range, and `readChart(chartText(item))` its labels and values, for random items | Property test, 500 each | The item |
| G-5 | Malformed edit text (unknown name, range with min ≥ max, a chart line without a number, more than 6 functions or 40 values) fails with the line number; nothing is guessed | Example table | Construction |
| G-6 | Graphs and charts survive validation, files, moving and scaling like every other item | The existing property tests with the new types in `tests/random.ts` | The model claims |

## Corpus

Random functions are expression trees from the calculation tests, ranges and items from fixed seeds.

## Thresholds

All claims 100 %.

## Results

| Claim | Date | Result |
|---|---|---|
| G-1 | 2026-10-05 | 2000 / 2000 ranges |
| G-2 | 2026-10-05 | 300 / 300 functions: every plotted point inside the view, every pair of samples inside it drawn |
| G-3 | 2026-10-05 | 1/x and tan split at their poles |
| G-4 | 2026-10-05 | 500 / 500 graphs and charts round-trip, plus German decimal commas and "y =", "f(x) =", "bis" |
| G-5 | 2026-10-05 | 6 / 6 malformed texts fail with the right line |
| G-6 | 2026-10-05 | G1 to G5 (geometry), files and sync tests pass with graphs and charts among the random items |
| Real app | 2026-10-05 | headless (`node tools/render.ts OUT graphs`): a bar chart from the palette with five values typed into its dialog (one negative, labelled below the axis) and a graph of sin(x), x^2/4 - 3 and 1/x with the pole split. Found and fixed on the way: after the dialog closed, focus stayed in its hidden field and swallowed every shortcut; and applying the values put the chart back at the origin, because the dialog wrote back the item from before it was placed |

## Known gaps

- Between two of the 400 samples a steep but continuous curve that leaves the view above and comes back below
  is drawn with a gap there, the same rule that splits tan at its poles.
- Error details from the expression parser are in English in both interface languages.
- A chart has one series; it is not linked to the table it came from.
