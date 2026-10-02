# Verification: model, history, viewport

Covers `src/model/` (boards, elements, validation), `src/editor/history.ts` and `src/editor/viewport.ts`.

## Claims

| # | Claim | Method | Oracle |
|---|---|---|---|
| M1 | Every board built through the model functions survives `JSON.stringify` → `JSON.parse` → `validateBoard` and is deep-equal to the original | Property test, 500 seeded random boards with every item type | `assert.deepStrictEqual` against the original value |
| M2 | Replacing any single field of a valid board or item with a value of the wrong type, or adding an unknown field, is rejected, and the error names that exact JSON path | Exhaustive over every field of one board holding one item of each type | The path of the mutation, known by construction |
| M3 | `updateItem` returns a new item with `version + 1` and a fresh nonce; every other item in the board keeps its object identity | Example plus property test over random boards | Object identity (`===`) |
| H1 | After any sequence of commits, undos and redos, the current state equals the state a plain list-of-snapshots model predicts, and the history never holds more than its limit | Property test, 1000 seeded random operation sequences of length up to 300 | A naive reference model in the test (array plus index), written independently |
| H2 | Undo and redo restore the visible content of the target snapshot exactly, and every item they change gets a higher version than the item it replaces | Property test, 300 random sessions of 8 edits, undone to the start and redone once | The snapshot content recorded during the session; the versions before the undo |
| V1 | `screenToWorld(worldToScreen(p)) = p` within 1e-9 relative error | Property test, 10 000 random points, zooms 0.1 to 8, offsets ±1e6 | Algebra (identity) |
| V2 | `zoomAt(anchor, factor)` keeps the world point under the anchor fixed, within 1e-9 | Property test, same ranges as V1 | The world point computed before the zoom |
| V3 | Zoom stays inside `[MIN_ZOOM, MAX_ZOOM]` for any factor sequence | Property test, 1000 sequences of 50 factors in [0.01, 100] | The bounds |

## Corpus

Generated, with a fixed seed printed by each test, so a failure can be replayed. There is no real-world board
corpus yet; boards saved by the owner become one in phase 5 (`tests/fixtures/`, with their app version).

## Thresholds

100 % of generated cases pass for every claim. Results are recorded below with the date.

## Results

| Claim | Date | Result |
|---|---|---|
| M1 | 2026-10-02 | 500 / 500 boards round-trip |
| M2 | 2026-10-02 | every leaf path of a one-item board (73 paths) plus unknown fields at both levels rejected at the right path; the first run found a wrong path for non-object items, fixed |
| M3 | 2026-10-02 | 200 / 200 |
| H1 | 2026-10-02 | 1000 / 1000 sequences |
| H2 | 2026-10-02 | 300 / 300 sessions |
| V1, V2, V3 | 2026-10-02 | 10 000 / 10 000, 10 000 / 10 000, 1000 / 1000 |

## Known gaps

- Validation checks structure and ranges, not visual sense (a 0 × 0 rectangle is valid).
- Floating-point: V1 and V2 hold within the stated tolerance only; positions beyond ±1e6 are not tested.
