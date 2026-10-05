# Verification: geometry

Covers `src/geometry/box.ts`, `bounds.ts`, `hit.ts` and `transform.ts`: item bounds, hit tests, moving and
scaling. Marks have no geometry of their own (they follow their text, see annotate.md) and are left out
of these claims; for them `hitItem` is always false. The pen outline (perfect-freehand) is a library and the shape outlines
(`outline.ts`) are path strings; both are checked by looking at screenshots.

## Claims

| # | Claim | Method | Oracle |
|---|---|---|---|
| G1 | `boundsOf(item)` contains every stored point of strokes and lines, every corner of polygons, and the full box of shapes, text and notes, widened by half the stroke width | Property test, 2000 random items of every type except marks | The stored geometry, read directly |
| G2 | `hitItem` is true for the centre of filled boxes, ellipses, notes and text, and for every stored point of strokes and lines and every corner of polygons | Property test, 2000 random items | Construction |
| G3 | `hitItem` is false for every point farther than tolerance plus stroke width outside `boundsOf(item)` | Property test, 2000 items × 20 points | `boundsOf` (G1) |
| G4 | `moveItem` by (dx, dy) moves `boundsOf` by exactly (dx, dy) | Property test, 2000 items | Arithmetic on the bounds |
| G5 | `scaleItem(item, from, to)` maps the item's geometric box (bounds without stroke padding) from `from` to `to` within 1e-6, for every type with a free aspect ratio; text scales uniformly by the smaller factor | Property test, 2000 items, boxes with sides 1 to 2000 | The affine map from `from` to `to` |
| G6 | An eraser swipe erases every item its path crosses, even where two samples lie farther apart than the eraser reach | Example test (`tests/editor.test.ts`): two strokes between two samples 300 units apart | Construction |
| G7 | For bent lines the curve's middle, control point and bend agree: the sampled middle is `curveMiddle`, and `bendThrough` of that middle gives the bend back (1e-9); G1 to G5 hold for bent lines too, G5 with even scaling (ADR 0009) | Property test, 2000 random chords and bends; the random items include bent lines | The quadratic curve formula |

## Corpus

Generated with fixed seeds (`tests/random.ts`).

## Thresholds

100 % for every claim.

## Results

| Claim | Date | Result |
|---|---|---|
| G1 | 2026-10-02 | 2000 / 2000 items |
| G2 | 2026-10-02 | 2000 / 2000 items |
| G1, G2, G3 | 2026-10-05 | 2000 / 2000 items each, now including polygons with 3 to 10 random corners |
| G3 | 2026-10-02 | 40 000 / 40 000 points |
| G4 | 2026-10-02 | 2000 / 2000 items |
| G5 | 2026-10-02 | 2000 / 2000 items; in the running app a 200 × 100 box dragged by (+100, +50) on its corner became exactly 300 × 150 at the same origin (headless check) |
| G6 | 2026-10-04 | passes; the same test fails on the previous eraser, which only tested the samples |
| G7 | 2026-10-05 | 2000 / 2000; G5 first failed on bent lines scaled unevenly, which a bend cannot follow exactly; G5 now scales bent lines evenly and ADR 0009 states the approximation |

## Known gaps

- Hit tests on unfilled shapes check the outline only through a tolerance band, not the exact rough path.
- Text bounds come from measurements stored at edit time; a missing font at render time can make the drawn text
  wider than its bounds.
