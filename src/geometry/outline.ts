// Clean outlines of shapes, notes, lines and arrows as SVG path data in item-local coordinates: true ellipses,
// straight edges, one open arrow head. Not here: colour, width or drawing (src/render).
import type { LineItem, NoteItem, PolygonItem, ShapeItem } from "../model/item.ts";
import { SHAPE_WIDTH } from "./widths.ts";

const ARROW_ANGLE = Math.PI / 6.5;

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

export function boxOutline(item: ShapeItem | PolygonItem | NoteItem): string {
  const w = round(item.width);
  const h = round(item.height);
  switch (item.type) {
    case "ellipse": {
      const [rx, ry] = [round(item.width / 2), round(item.height / 2)];
      return `M0 ${ry}A${rx} ${ry} 0 1 0 ${w} ${ry}A${rx} ${ry} 0 1 0 0 ${ry}Z`;
    }
    case "polygon":
      return `${item.corners
        .map(([u, v], i) => `${i === 0 ? "M" : "L"}${round(u * item.width)} ${round(v * item.height)}`)
        .join("")}Z`;
    default:
      return `M0 0H${w}V${h}H0Z`;
  }
}

export function lineOutline(item: LineItem): string {
  const [[ax, ay], [bx, by]] = item.points;
  const shaft = `M${round(ax)} ${round(ay)}L${round(bx)} ${round(by)}`;
  if (item.type === "line") return shaft;
  const angle = Math.atan2(by - ay, bx - ax);
  const head = Math.min(Math.hypot(bx - ax, by - ay) / 2, 10 + SHAPE_WIDTH[item.size] * 4);
  const wing = (side: number): string => {
    const direction = angle + Math.PI + side * ARROW_ANGLE;
    return `${round(bx + Math.cos(direction) * head)} ${round(by + Math.sin(direction) * head)}`;
  };
  // One path through the tip, so the head gets a round join instead of two overlapping caps.
  return `${shaft}M${wing(-1)}L${round(bx)} ${round(by)}L${wing(1)}`;
}
