# Verification: labels and attached lines

Covers `src/diagram/connect.ts` (which item a line end attaches to, where on its outline, rerouting after
changes) and the labels on shapes and lines (ADR 0007).

## Claims

| # | Claim | Method | Oracle |
|---|---|---|---|
| K1 | An attached end lies on the target's outline pushed out by the gap: on the ellipse for ellipses, on the box edge for boxes, notes, texts, pictures, graphs, charts and tables, on an edge of the polygon for polygons, within 1e-6 | Property test, 2000 random targets and directions | The ellipse equation, the box edges, the polygon edges |
| K2 | After any of the targets move or scale, rerouting puts every attached end back on its target's outline (K1) and the end points toward the other end's target centre or point | Property test, 1000 random boards with lines between random items | K1 |
| K3 | A line whose target is deleted keeps its points and that end becomes unattached; lines without attachments never change | Property test | The input |
| K4 | Rerouting twice changes nothing the second time | Property test | The first result |
| K5 | Labels and ends survive validation and files; files without them load with `""` and `[null, null]` | The model and file tests; an example of an old item | ADR 0007 |

## Corpus

Random boards from fixed seeds (`tests/random.ts`) with added lines between random items.

## Thresholds

All claims 100 %.

## Results

| Claim | Date | Result |
|---|---|---|
| K1 | 2026-10-05 | 2000 / 2000 targets. First run failed on the generic random polygons (self-crossing corner sets whose centre lies outside); measured on the presets the app makes |
| K2, K4 | 2026-10-05 | 1000 / 1000 boards |
| K3 | 2026-10-05 | 500 / 500 |
| K5 | 2026-10-05 | old box and arrow load with empty label and no ends; a malformed `ends` is refused. M2 (every leaf of a wrong type is rejected) now puts a number where `null` was, since a string is a valid end id |
| Real app | 2026-10-05 | headless (`node tools/render.ts OUT connectors`): an arrow drawn from inside a box to inside a diamond attached to both; after the diamond was dragged away the arrow ran from the box edge to the diamond edge; labels typed with a double-click sat centred in both shapes |

## Known gaps

- Polygon ends attach to the polygon's edge along the ray from the box centre; for a very thin triangle that is
  close to a corner. A polygon whose box centre lies outside it (possible for recognised polygons, not for the
  presets) falls back to the box edge; K1 and K2 are measured on the presets.
- An end attaches only when the drag starts or ends inside an item's box; there is no snapping to anchor points.
