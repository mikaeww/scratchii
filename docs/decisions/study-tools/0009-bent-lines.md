# 0009: Bent lines and arrows

**Status:** accepted
**Date:** 2026-10-05

## Context
Arrows drawn by hand are often curved, and diagrams need arrows that go around things. The owner asked for
round arrows after the study tools round. Lines and arrows stored only their two ends.

## Options
- A free control point per line: exact under every scaling, but the bend handle, rerouting attached lines and
  labels at the middle would each have to keep a point that no longer sits on the chord's perpendicular.
- A polyline with several points: drawn arrows would look like the freehand stroke they came from.
- One number, `bend`: how far the middle of a quadratic curve lies from the chord's middle, in chord lengths, to
  the left of the direction. It survives moving, rerouting and even scaling unchanged.

## Decision
`bend: number` on line and arrow, optional when read (missing means 0, straight), limited to ±2. The curve is the
quadratic through both ends whose middle lies `bend` chord lengths off the chord (src/geometry/outline.ts); the
head follows the curve's direction at the end. Uneven scaling keeps the bend through the scaled middle, a close
approximation where a true quadratic would lean to one side.

## Consequences
- Hit tests, bounds and labels use the sampled curve (32 segments).
- Older app versions refuse boards with bent lines (unknown field, reported with its path).
- The pen snaps bent lines and arrows, and joins a separately drawn head with the stroke before it
  (src/recognize/curves.ts, arrows.ts); a selected line has a round handle at its middle that bends it.
