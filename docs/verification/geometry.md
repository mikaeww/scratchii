# Verification: geometry

Covers `src/geometry/box.ts`, `bounds.ts`, `hit.ts` and `transform.ts`: item bounds, hit tests, moving and
scaling. Marks have no geometry of their own (they follow their text, see annotate.md) and are left out
of these claims; for them `hitItem` is always false. The hand-drawn outlines themselves (roughjs, perfect-freehand) are libraries and are checked only by
looking at screenshots.

## Claims

| # | Claim | Method | Oracle |
|---|---|---|---|
| G1 | `boundsOf(item)` contains every stored point of strokes and lines, and the full box of shapes, text and notes, widened by half the stroke width | Property test, 2000 random items of every type except marks | The stored geometry, read directly |
| G2 | `hitItem` is true for the centre of filled shapes, notes and text, and for every stored point of strokes and lines | Property test, 2000 random items | Construction |
| G3 | `hitItem` is false for every point farther than tolerance plus stroke width outside `boundsOf(item)` | Property test, 2000 items × 20 points | `boundsOf` (G1) |
| G4 | `moveItem` by (dx, dy) moves `boundsOf` by exactly (dx, dy) | Property test, 2000 items | Arithmetic on the bounds |
| G5 | `scaleItem(item, from, to)` maps the item's geometric box (bounds without stroke padding) from `from` to `to` within 1e-6, for every type with a free aspect ratio; text scales uniformly by the smaller factor | Property test, 2000 items, boxes with sides 1 to 2000 | The affine map from `from` to `to` |

## Corpus

Generated with fixed seeds (`tests/random.ts`).

## Thresholds

100 % for every claim.

## Results

| Claim | Date | Result |
|---|---|---|
| G1 | 2026-10-02 | 2000 / 2000 items |
| G2 | 2026-10-02 | 2000 / 2000 items |
| G3 | 2026-10-02 | 40 000 / 40 000 points |
| G4 | 2026-10-02 | 2000 / 2000 items |
| G5 | 2026-10-02 | 2000 / 2000 items; in the running app a 200 × 100 box dragged by (+100, +50) on its corner became exactly 300 × 150 at the same origin (headless check) |

## Known gaps

- Hit tests on unfilled shapes check the outline only through a tolerance band, not the exact rough path.
- Text bounds come from measurements stored at edit time; a missing font at render time can make the drawn text
  wider than its bounds.
