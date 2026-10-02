# Verification: recognition

Covers `src/recognize/shapes.ts` (a pen stroke held still at its end becomes a line, arrow, box or ellipse)
and `src/recognize/highlight.ts` (a marker stroke over a text line becomes a highlight mark on that line).

## Claims

| # | Claim | Method | Oracle |
|---|---|---|---|
| R1 | At least 95 % of generated hand-like strokes of each class (line, arrow, box, ellipse) are classified as that class | Property test, 500 strokes per class with jitter, wobble, overshoot and gaps | The generator's class |
| R2 | At most 5 % of generated non-shapes (scribbles, waves, spirals, zigzags, letters S, m, z) are classified as any shape | Property test, 500 strokes per kind | The generator: none of them is a shape |
| R3 | For correctly classified boxes and ellipses, the result box is within 10 % of the generating box on each side (relative to its size); line and arrow ends are within 10 % of the length | Same corpus as R1 | The generator's box and ends |
| R4 | A horizontal marker stroke inside the band of line k of a text, with at least half of it over the line, becomes a mark on that text with lines [k, k] (or [first, last] when it spans several lines) | Property test, 1000 random texts and strokes | Construction |
| R5 | Marker strokes that do not overlap any text line return no target | Property test, 1000 cases | Construction |
| R6 | The highlight spans exactly the overlapped part of the line in `u` (clamped to [0, 1]; full line when ≥ 85 % is covered) | Property test, 1000 cases | The overlap computed in the test |

## Corpus

Generated with fixed seeds in `tests/strokes.ts`. This is the weakest part of the evidence: the generator is
a model of a hand, written by the same author as the recogniser. A recorded corpus of real strokes (pen tablet
and mouse) is the next step and goes into `tests/fixtures/strokes/` with device and date.

## Thresholds

R1 ≥ 95 % per class, R2 ≤ 5 % per kind, R3 100 % of correctly classified strokes, R4 to R6 100 %.

## Results

| Claim | Date | Result |
|---|---|---|
| R1 | 2026-10-02 | line 500/500, arrow 498/500, box 500/500, ellipse 500/500. First runs: arrows 265/500 (straightness measured as chord/length, broken by jitter; tip taken at the second pass; head length from the raw instead of the resampled path), fixed one by one |
| R2 | 2026-10-02 | scribble 0, wave 9, spiral 0, zigzag 0, S 0, m 0, z 0 of 500 each |
| R3 | 2026-10-02 | 100 % of correctly classified strokes in place |
| R4, R6 | 2026-10-02 | 1000 / 1000 |
| R5 | 2026-10-02 | 1000 / 1000 |
| Real app | 2026-10-02 | headless: a wobbly box, a loop and a one-stroke arrow held still for 700 ms snapped to box, ellipse and arrow; a wave without hold stayed a stroke; a marker stroke over the first half of a text became a highlight on that part |

## Known gaps

- Only axis-aligned boxes and ellipses: the item model has no rotation. A strongly tilted box is reported as
  no shape or as an ellipse.
- Arrows must be drawn in one stroke (shaft, then the head). Two-stroke arrows stay strokes.
- No real-stroke corpus yet (see above).
