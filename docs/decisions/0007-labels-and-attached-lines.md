# 0007: Labels on shapes and lines, lines attached to items

**Status:** accepted
**Date:** 2026-10-05

## Context
Diagrams need text inside boxes and on arrows, and arrows that stay on their boxes when the boxes move
(docs/plans/2026-10-05-study-tools.md, steps 5 and 6). Text items placed on top of a shape do not follow it,
and an arrow that only stores two points cannot know what it points at.

## Options
- Group a shape with a text item and an arrow with two shapes: needs a grouping model, selection rules and
  merge rules for groups; much more than this needs.
- A `label` on shapes, polygons and lines, and `ends` on lines naming the item each end is attached to; the
  editor recomputes attached ends whenever items change.
- Keep geometry as is and recompute arrows only at render time: exports, hits and sync would disagree about
  where an arrow is.

## Decision
`label: string` on rect, ellipse, polygon, line and arrow; `ends: [id | null, id | null]` on line and arrow.
The editor reroutes attached lines in every draft and every commit, so the stored points are always where the
line is drawn and undo, export, hit tests and sync need no special case. A line whose target is deleted keeps
its points and drops the attachment. Moving a line on its own detaches the ends whose items stay put.

Both fields are optional when a file or a sync request is read (missing means `""` and `[null, null]`), so
boards written before keep loading. Older app versions refuse boards with the new fields (unknown field,
reported with its path), the same as for the new item types.

## Consequences
- Labels are drawn centred and wrapped inside the shape's box; a label longer than the shape spills over.
- Rerouting runs on every pointer move while dragging; it touches only lines attached to what moved.
- Two devices moving the two ends' items at the same time each reroute; the newer version of the line wins in
  the merge and the next local change reroutes it again.
