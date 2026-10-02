# Verification: sync merge and server

Covers `src/model/merge.ts` (how two copies of a board become one), `server/` (the self-hosted sync server)
and `src/sync/` (the client that pushes and pulls).

## Merge rules

Per item id the copy with the higher `version` wins; equal versions are decided by the lower `nonce`; equal
version and nonce mean the same edit; should two different edits ever collide on both, the tombstone wins, then
the smaller JSON text, so the order stays total. Deletions are tombstones and win like any other version. Title and tags
win by `metaUpdated`, ties by the lexically smaller title. The merged board's `updated` is the larger of the two.
Stacking order: items of the first argument keep their order, items only the second has are appended.

The server numbers every write with a revision; clients remember the last revision they saw per board and the
board's own `updated` when they last pushed it, so no comparison ever mixes the clocks of two devices. Each
device keeps `updated` monotonic per board. A tombstone keeps the board's last `updated`; a copy edited after
that revives the board instead of being refused.

## Claims

| # | Claim | Method | Oracle |
|---|---|---|---|
| S1 | `merge(a, b)` and `merge(b, a)` hold the same items (as a map by id) and the same title, tags and `updated` | Exhaustive: every pair of boards over 2 ids × presence × version {1, 2} × nonce {1, 2} × deleted {no, yes} | Map equality |
| S2 | `merge(merge(a, b), c)` and `merge(a, merge(b, c))` hold the same items and metadata | Exhaustive over all triples from a reduced space (2 ids, version {1, 2}, nonce {1, 2}) | Map equality |
| S3 | `merge(a, a)` equals `a` | Exhaustive over the S1 space | Deep equality |
| S4 | No edit is lost: for every id, the merged version is the maximum version of the inputs, and the merged item is one of the inputs' items | Exhaustive over the S1 space plus 2000 random board pairs | The inputs |
| S5 | The server rejects requests without the right token with 401 and touches no data; a wrong token of equal length is rejected too | Integration test against a real server on a free port with a temporary database | Status codes and the database file |
| S6 | The server rejects an invalid board with 400 naming the JSON path, a body over the limit with 413, and a board whose id differs from the URL with 400 | Integration test | Status codes and messages |
| S7 | Static files are served only from the built app directory; `..` and encoded traversal never leave it | Integration test with `../`, `%2e%2e/` and absolute paths | A secret file next to the app directory that must never be returned |
| S8 | Two clients that edit different items of the same board both see both edits after syncing; one client's deletion of a board reaches the other | Integration test with two in-process clients against one server | The items each client wrote |

## Corpus

Exhaustive spaces as described; random boards from `tests/random.ts`.

## Thresholds

100 % for every claim. Integration tests use their own temporary directory and a free port.

## Results

| Claim | Date | Result |
|---|---|---|
| S1, S3, S4 | 2026-10-02 | 6561 / 6561 pairs; 2000 / 2000 random pairs. The first exhaustive run found that equal version and nonce with different content made the merge depend on argument order; fixed with a total order (tombstone, then JSON text), the same for metadata ties |
| S2 | 2026-10-02 | 15 625 / 15 625 triples |
| S5 | 2026-10-02 | 4 token variants × 2 requests, all 401, database file untouched |
| S6 | 2026-10-02 | 400 with `body.title`, 413, 400 for a mismatched id |
| S7 | 2026-10-02 | 5 / 5 traversal attempts answered 404 without the secret |
| S8 | 2026-10-02 | two in-process devices: both edits arrive both ways, item and board deletions travel, a quiet round writes nothing, a restored board comes back everywhere. The first design compared timestamps across devices and lost an edit made in the same millisecond; replaced by server revisions |
| Real app | 2026-10-02 | real server (`npm run server`) with a throwaway database, two separate headless browsers on the served app: a box and a title from one, an ellipse from the other, both on both sides within two rounds, status "synced", no page errors |

## Known gaps

- Stacking order is not merged: each device keeps its own order and appends items it has not seen.
- No live collaboration: changes travel every few seconds, not per keystroke.
- One shared token per server, no user accounts.
