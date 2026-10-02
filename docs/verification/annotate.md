# Verification: marks (underlines, strike-throughs, boxes, highlights)

Covers `src/annotate/` (presets, layout of marks on text lines, own presets) and the cascade in
`src/editor/editor.ts` that removes marks with their text.

A mark stores its strokes in line-local units: `u` along the line (0 = start, 1 = end of the measured text for
stretched marks, one line height per period for repeated marks), `v` across it (0 = top, 1 = bottom of the line
box). Layout maps them onto the target text's line boxes, then adds a small seeded wobble.

## Claims

| # | Claim | Method | Oracle |
|---|---|---|---|
| A1 | For stretched marks, every laid-out point lies within `WOBBLE × line height` of the affine map `(line.x + u·w, line.y + v·h)` | Property test, 2000 random marks × random line boxes, every preset | The affine map, computed in the test |
| A2 | For repeated marks, no laid-out point lies further right than `line.x + w + WOBBLE·h`, and the points reach at least `line.x + w − h` | Property test, 2000 random line boxes per repeated preset | The line box |
| A3 | Moving the target text by (dx, dy) moves every laid-out point by exactly (dx, dy) | Property test, 2000 cases | Arithmetic |
| A4 | Committing a deleted text also commits every live mark on it as deleted, in the same history step, so one undo brings both back | Property test, 300 random sessions | The marks' `target` fields |
| A5 | Normalising strokes drawn over the guide word and laying them out on a line box of the guide's size reproduces the drawn points within `WOBBLE × h` | Property test, 1000 random drawings | The drawn points |

## Corpus

Generated with fixed seeds; the eight built-in presets are enumerated in every applicable test.

## Thresholds

100 % for every claim.

## Results

| Claim | Date | Result |
|---|---|---|
| A1 | 2026-10-02 | 2000 / 2000 marks |
| A2 | 2026-10-02 | 2000 / 2000 line boxes for each of the three repeated presets |
| A3 | 2026-10-02 | 2000 / 2000 |
| A4 | 2026-10-02 | 300 / 300 sessions |
| A5 | 2026-10-02 | 1000 / 1000 drawings; in the running app a stroke drawn in the pad became a mark on the text and an "Own mark" entry in the menu (headless check) |

## Known gaps

- Marks are laid out on the text as measured with the real font at render time; a missing font changes widths.
- Marks attach to text items only, not to text inside sticky notes.
- Repeated marks cut the last period at the end of the line rather than ending on a whole wave.
