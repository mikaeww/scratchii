# 0005: Clean shape outlines without shadows

**Status:** accepted
**Date:** 2026-10-05

## Context
ADR 0002 put Neo Brutalism into what is drawn, including hard offset shadows, and the shapes were drawn with
roughjs as one wobbly marker line. The owner asked for shapes that look like a real drawing program: round
circles, not thicker on the sides, easy to draw, and more kinds. On a filled ellipse the offset shadow reads as
a thicker outline on the right and bottom, and the roughjs ellipse is lumpy and overshoots its start.

## Options
- Keep roughjs with less roughness and a smaller shadow: still lumpy circles and a crescent on every fill.
- Clean geometry for boxes, ellipses, polygons, lines and arrows; shadows only on sticky notes.
- Clean geometry and no shadows anywhere on the canvas.

## Decision
Clean geometry: true ellipses, straight edges with round joins, one open arrow head. Sticky notes keep the
hard offset shadow, they are paper cards like the interface panels; drawn shapes have none. Pen strokes stay
freehand. roughjs is removed. This replaces the "hard offset shadows in what is drawn" part of ADR 0002;
the rest of ADR 0002 stands.

## Consequences
- One dependency less; outlines are a few lines of SVG path data (`src/geometry/outline.ts`).
- Boards look different after the update: existing shapes render clean, nothing in the file format changes
  for them. The `seed` field no longer affects shapes.
- New closed shapes are `polygon` items whose corners are fractions of their box, so moving and scaling stay
  box arithmetic. Older app versions refuse boards that contain them (unknown item type, reported with path).
