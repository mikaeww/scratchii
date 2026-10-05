// Lines and arrows attached to items (ADR 0007): which item a line end attaches to, where on its outline the
// end sits, and rerouting every attached line after items changed. Pure. Not here: when rerouting runs
// (src/editor/editor.ts).
import { shapeBox } from "../geometry/bounds.ts";
import { contains, grow, type Box } from "../geometry/box.ts";
import { insidePolygon, polygonCorners } from "../geometry/polygon.ts";
import { reviseItem, type Item, type LineItem } from "../model/item.ts";

type Point = readonly [number, number];

// World units between an attached end and its item's outline, so an arrow head does not sit on the outline.
export const ATTACH_GAP = 6;

const ATTACHABLE = new Set<Item["type"]>([
  "rect",
  "ellipse",
  "polygon",
  "note",
  "text",
  "image",
  "graph",
  "chart",
  "table",
]);

export function isAttachable(item: Item): boolean {
  return ATTACHABLE.has(item.type) && !item.deleted;
}

// The topmost attachable item whose box (widened by `reach`) holds the point.
export function attachTarget(items: readonly Item[], point: Point, reach: number): Item | null {
  for (let i = items.length - 1; i >= 0; i--) {
    const item = items[i];
    if (item !== undefined && isAttachable(item) && contains(grow(shapeBox(item), reach), point)) return item;
  }
  return null;
}

function centreOf(box: Box): Point {
  return [box.x + box.width / 2, box.y + box.height / 2];
}

// Where the ray from `from` in direction (dx, dy) leaves the segment a–b, as a multiple of the direction.
function raySegment(from: Point, [dx, dy]: Point, a: Point, b: Point): number | null {
  const [ex, ey] = [b[0] - a[0], b[1] - a[1]];
  const denominator = dx * ey - dy * ex;
  if (denominator === 0) return null;
  const t = ((a[0] - from[0]) * ey - (a[1] - from[1]) * ex) / denominator;
  const u = ((a[0] - from[0]) * dy - (a[1] - from[1]) * dx) / denominator;
  return t >= 0 && u >= 0 && u <= 1 ? t : null;
}

// How far along the unit direction the item's outline is from `origin`, a point inside the item.
function outlineDistance(item: Item, box: Box, origin: Point, direction: Point): number {
  const [dx, dy] = direction;
  if (item.type === "ellipse") {
    const [cx, cy] = centreOf(box);
    const [rx, ry] = [box.width / 2 || 1, box.height / 2 || 1];
    const [px, py, qx, qy] = [(origin[0] - cx) / rx, (origin[1] - cy) / ry, dx / rx, dy / ry];
    const [a, b, c] = [qx * qx + qy * qy, 2 * (px * qx + py * qy), px * px + py * py - 1];
    return a === 0 ? 0 : (-b + Math.sqrt(Math.max(0, b * b - 4 * a * c))) / (2 * a);
  }
  if (item.type === "polygon") {
    const corners = polygonCorners(item);
    const hits = corners
      .map((corner, i) => raySegment(origin, direction, corner, corners[(i + 1) % corners.length] ?? corner))
      .filter((t): t is number => t !== null);
    if (hits.length > 0) return Math.max(...hits);
  }
  const along = (o: number, d: number, low: number, high: number): number =>
    d > 0 ? (high - o) / d : d < 0 ? (low - o) / d : Infinity;
  return Math.min(
    along(origin[0], dx, box.x, box.x + box.width),
    along(origin[1], dy, box.y, box.y + box.height),
  );
}

// A sideways shift stays well inside the item, so the ray still starts within it.
function inside(box: Box, side: Point): Point {
  const room = (0.4 * Math.min(box.width, box.height)) / 2;
  const length = Math.hypot(side[0], side[1]);
  return length <= room ? side : [(side[0] / length) * room, (side[1] / length) * room];
}

// The point on the item's outline, pushed out by the gap, on the way from its centre (shifted by `side`)
// toward `toward`.
export function attachPoint(item: Item, toward: Point, gap = ATTACH_GAP, side: Point = [0, 0]): Point {
  const box = shapeBox(item);
  const [cx, cy] = centreOf(box);
  const [sx, sy] = inside(box, side);
  const shifted: Point = [cx + sx, cy + sy];
  // Between the points of a star or near a triangle's tip the shifted start can fall outside the shape.
  const outside = item.type === "polygon" && !insidePolygon(shifted, polygonCorners(item));
  const origin: Point = outside ? [cx, cy] : shifted;
  const length = Math.hypot(toward[0] - origin[0], toward[1] - origin[1]);
  const direction: Point =
    length === 0 ? [1, 0] : [(toward[0] - origin[0]) / length, (toward[1] - origin[1]) / length];
  const distance = outlineDistance(item, box, origin, direction) + gap;
  return [origin[0] + direction[0] * distance, origin[1] + direction[1] * distance];
}

function sideways(a: Item | null, b: Item | null, offset: number): Point {
  if (a === null || b === null || offset === 0) return [0, 0];
  // Ordered by id, so the line from a to b and the one back from b to a agree on which side is which.
  const [first, second] = a.id < b.id ? [a, b] : [b, a];
  const [p, q] = [centreOf(shapeBox(first)), centreOf(shapeBox(second))];
  const length = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1;
  return [(-(q[1] - p[1]) / length) * offset, ((q[0] - p[0]) / length) * offset];
}

function worldPoints(line: LineItem): [Point, Point] {
  const [[ax, ay], [bx, by]] = line.points;
  return [
    [line.x + ax, line.y + ay],
    [line.x + bx, line.y + by],
  ];
}

const SAME = 1e-9;
// World units between lines that join the same two items, so a way there and a way back do not overlap.
const PARALLEL_GAP = 36;

// The line with its attached ends back on their items, or null when nothing changes. A missing or deleted
// target drops that attachment and keeps the point.
// `offset` shifts both aims sideways (perpendicular to the line between the two items, the same side for both
// directions), so parallel lines land beside each other and their ends still sit on the outlines.
export function rerouted(line: LineItem, byId: ReadonlyMap<string, Item>, offset = 0): LineItem | null {
  if (line.ends[0] === null && line.ends[1] === null) return null;
  const targets = line.ends.map((id) => {
    const item = id === null ? undefined : byId.get(id);
    return item !== undefined && isAttachable(item) ? item : null;
  });
  const [start, end] = worldPoints(line);
  const [a, b] = targets;
  const side = sideways(a ?? null, b ?? null, offset);
  const aim = (target: Item | null, own: Point): Point => {
    if (target === null) return own;
    const centre = centreOf(shapeBox(target));
    return [centre[0] + side[0], centre[1] + side[1]];
  };
  const from = a === null || a === undefined ? start : attachPoint(a, aim(b ?? null, end), ATTACH_GAP, side);
  const to = b === null || b === undefined ? end : attachPoint(b, aim(a ?? null, start), ATTACH_GAP, side);
  const ends: LineItem["ends"] = [a ? line.ends[0] : null, b ? line.ends[1] : null];
  const moved = [from, to].some((p, i) => {
    const old = i === 0 ? start : end;
    return Math.abs(p[0] - old[0]) > SAME || Math.abs(p[1] - old[1]) > SAME;
  });
  if (!moved && ends[0] === line.ends[0] && ends[1] === line.ends[1]) return null;
  return {
    ...line,
    x: from[0],
    y: from[1],
    points: [
      [0, 0],
      [to[0] - from[0], to[1] - from[1]],
    ],
    ends,
  };
}

// Every attached line that has to follow, given the scene after a change. Unchanged lines are left out.
function pairKey(line: LineItem): string | null {
  const [a, b] = line.ends;
  return a === null || b === null ? null : [a, b].sort().join(" ");
}

export function reroute(scene: readonly Item[], revise: boolean): LineItem[] {
  const byId = new Map(scene.map((item) => [item.id, item]));
  const lines = scene.filter(
    (item): item is LineItem => (item.type === "line" || item.type === "arrow") && !item.deleted,
  );
  const pairs = new Map<string, LineItem[]>();
  for (const line of lines) {
    const key = pairKey(line);
    if (key !== null) pairs.set(key, [...(pairs.get(key) ?? []), line]);
  }
  const out: LineItem[] = [];
  for (const line of lines) {
    const group = pairs.get(pairKey(line) ?? "") ?? [line];
    const offset = (group.indexOf(line) - (group.length - 1) / 2) * PARALLEL_GAP;
    const next = rerouted(line, byId, offset);
    if (next !== null) out.push(revise ? reviseItem(next) : next);
  }
  return out;
}

// A line moved on its own lets go of the items that stay put.
export function detached(line: LineItem, moving: ReadonlySet<string>): LineItem {
  const keep = (id: string | null): string | null => (id !== null && moving.has(id) ? id : null);
  return { ...line, ends: [keep(line.ends[0]), keep(line.ends[1])] };
}
