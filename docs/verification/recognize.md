# Verification: recognition

Covers `src/recognize/shapes.ts` and `polygons.ts` (a pen stroke held still at its end becomes a line, arrow,
box, ellipse or polygon) and `src/recognize/highlight.ts` (a marker stroke over a text line becomes a highlight
mark on that line).

## Claims

| # | Claim | Method | Oracle |
|---|---|---|---|
| R1 | At least 95 % of generated hand-like strokes of each class (line, arrow, box, ellipse, triangle, diamond, one-stroke star) are classified as that class (triangles, diamonds and stars as polygons) | Property test, 500 strokes per class with jitter, wobble, overshoot and gaps | The generator's class |
| R2 | At most 5 % of generated non-shapes (scribbles, waves, spirals, zigzags, letters S, m, z) are classified as any shape | Property test, 500 strokes per kind | The generator: none of them is a shape |
| R3 | For correctly classified boxes, ellipses, diamonds and stars, the result box is within 10 % of the generating box on each side (relative to its size); line and arrow ends are within 10 % of the length; a triangle has exactly the generating corners, each within 10 % of the diagonal | Same corpus as R1 | The generator's box, ends and corners |
| R4 | A horizontal marker stroke inside the band of line k of a text, with at least half of it over the line, becomes a mark on that text with lines [k, k] (or [first, last] when it spans several lines) | Property test, 1000 random texts and strokes | Construction |
| R5 | Marker strokes that do not overlap any text line return no target | Property test, 1000 cases | Construction |
| R6 | The highlight spans exactly the overlapped part of the line in `u` (clamped to [0, 1]; full line when ≥ 85 % is covered) | Property test, 1000 cases | The overlap computed in the test |
| R7 | A pen stroke that snapped to a shape during a pause becomes a freehand stroke again when the pen moves on, and keeps every point drawn before and after the pause | Example test with mocked timers (`tests/editor.test.ts`): a straight stroke, a pause, then a turn | The points fed to the pen |
| R8 | Boxes and ellipses with a side ratio ≥ 0.95 come back square, ≤ 0.75 never; lines drawn within 2° of a 45° step come back exactly on it, lines 8° or more off never | Property test, 500 boxes, ellipses and lines (`tests/recognize.test.ts`) | The generator's box and angle |
| R9 | Polygons come back straightened: boxes leaning up to 8° with corners off by up to 4 % become level boxes; boxes leaning 15° to 30° become four corners with exact right angles; triangles on a base leaning up to 6° get an exactly level base | Property test, 500 strokes per case (`tests/recognize.test.ts`), ≥ 95 % each, every recognised one exact | The generator's lean and corners |

## Corpus

Generated with fixed seeds in `tests/strokes.ts`. This is the weakest part of the evidence: the generator is
a model of a hand, written by the same author as the recogniser. A recorded corpus of real strokes (pen tablet
and mouse) is the next step and goes into `tests/fixtures/strokes/` with device and date.

## Thresholds

R1 ≥ 95 % per class, R2 ≤ 5 % per kind, R3 100 % of correctly classified strokes, R4 to R6 and R8 100 %.

## Results

| Claim | Date | Result |
|---|---|---|
| R1 | 2026-10-02 | line 500/500, arrow 498/500, box 500/500, ellipse 500/500. First runs: arrows 265/500 (straightness measured as chord/length, broken by jitter; tip taken at the second pass; head length from the raw instead of the resampled path), fixed one by one |
| R2 | 2026-10-02 | scribble 0, wave 9, spiral 0, zigzag 0, S 0, m 0, z 0 of 500 each |
| R3 | 2026-10-02 | 100 % of correctly classified strokes in place |
| R4, R6 | 2026-10-02 | 1000 / 1000 |
| R5 | 2026-10-02 | 1000 / 1000 |
| Real app | 2026-10-02 | headless: a wobbly box, a loop and a one-stroke arrow held still for 700 ms snapped to box, ellipse and arrow; a wave without hold stayed a stroke; a marker stroke over the first half of a text became a highlight on that part |
| R7 | 2026-10-04 | passes; the same test fails on the previous pen, which dropped everything after the snap |
| R1 | 2026-10-05 | line 500, arrow 498, box 500, ellipse 500, triangle 500, diamond 500, star 500 of 500. First run: scribbles taken for ten-corner stars (88/500) and every letter M for a pentagon (500/500); fixed by checking that a ten-corner star alternates outer and inner corners and by allowing polygons only a gap of 10 % of the stroke between start and end |
| R2 | 2026-10-05 | scribble 0, wave 9, spiral 0, zigzag 0, S 0, m 0, z 0 of 500 each |
| R3 | 2026-10-05 | 100 % of correctly classified strokes in place |
| R8 | 2026-10-05 | passes; fails as expected with circle snapping or line levelling switched off |
| Real app | 2026-10-05 | headless (`node tools/render.ts OUT shapes`): a triangle, a narrow loop, a diamond, a one-stroke star and a tilted box held still for 700 ms snapped to triangle, ellipse, diamond, star and tilted polygon; a wave without hold stayed a stroke |
| R9 | 2026-10-05 | level 500, steep 500, triangle 500 of 500; fails with straightening switched off. First run: a box leaning 37° came back as a diamond; the diamond test now wants its corners within 8 % (was 12 %) of the box edge middles, so boxes up to about 30° stay boxes |

## Known gaps

- Only axis-aligned boxes and ellipses: the item model has no rotation. A box leaning 12° or more becomes a
  four-corner polygon with right angles; one leaning more than about 30° with corners near its box edge middles
  becomes a diamond. A tilted ellipse stays an axis-aligned ellipse or no shape.
- Polygons with seven to nine corners, and outline stars that do not alternate clearly, stay strokes.
- Arrows must be drawn in one stroke (shaft, then the head). Two-stroke arrows stay strokes.
- No real-stroke corpus yet (see above).
