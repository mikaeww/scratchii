// Lines and arrows attached to items (ADR 0007): which item a line end attaches to, where on its outline the
// end sits, and rerouting every attached line after items changed. Pure. Not here: when rerouting runs
// (src/editor/editor.ts).
import { shapeBox } from "../geometry/bounds.ts";
import { contains, grow, type Box } from "../geometry/box.ts";
import { polygonCorners } from "../geometry/polygon.ts";
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

// How far along the unit direction the item's outline is from its box centre.
function outlineDistance(item: Item, box: Box, direction: Point): number {
  const [dx, dy] = direction;
  const [rx, ry] = [box.width / 2, box.height / 2];
  if (item.type === "ellipse") {
    const scale = Math.hypot(dx / (rx || 1), dy / (ry || 1));
    return scale === 0 ? 0 : 1 / scale;
  }
  if (item.type === "polygon") {
    const corners = polygonCorners(item);
    const hits = corners
      .map((corner, i) =>
        raySegment(centreOf(box), direction, corner, corners[(i + 1) % corners.length] ?? corner),
      )
      .filter((t): t is number => t !== null);
    if (hits.length > 0) return Math.max(...hits);
  }
  const tx = dx === 0 ? Infinity : rx / Math.abs(dx);
  const ty = dy === 0 ? Infinity : ry / Math.abs(dy);
  return Math.min(tx, ty);
}

// The point on the item's outline, pushed out by the gap, on the way from its centre toward `toward`.
export function attachPoint(item: Item, toward: Point, gap = ATTACH_GAP): Point {
  const box = shapeBox(item);
  const centre = centreOf(box);
  const length = Math.hypot(toward[0] - centre[0], toward[1] - centre[1]);
  const direction: Point =
    length === 0 ? [1, 0] : [(toward[0] - centre[0]) / length, (toward[1] - centre[1]) / length];
  const distance = outlineDistance(item, box, direction) + gap;
  return [centre[0] + direction[0] * distance, centre[1] + direction[1] * distance];
}

function worldPoints(line: LineItem): [Point, Point] {
  const [[ax, ay], [bx, by]] = line.points;
  return [
    [line.x + ax, line.y + ay],
    [line.x + bx, line.y + by],
  ];
}

const SAME = 1e-9;

// The line with its attached ends back on their items, or null when nothing changes. A missing or deleted
// target drops that attachment and keeps the point.
export function rerouted(line: LineItem, byId: ReadonlyMap<string, Item>): LineItem | null {
  if (line.ends[0] === null && line.ends[1] === null) return null;
  const targets = line.ends.map((id) => {
    const item = id === null ? undefined : byId.get(id);
    return item !== undefined && isAttachable(item) ? item : null;
  });
  const [start, end] = worldPoints(line);
  const [a, b] = targets;
  const aim = (target: Item | null, own: Point): Point =>
    target === null ? own : centreOf(shapeBox(target));
  const from = a === null || a === undefined ? start : attachPoint(a, aim(b ?? null, end));
  const to = b === null || b === undefined ? end : attachPoint(b, aim(a ?? null, start));
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
export function reroute(scene: readonly Item[], revise: boolean): LineItem[] {
  const byId = new Map(scene.map((item) => [item.id, item]));
  const out: LineItem[] = [];
  for (const item of scene) {
    if ((item.type !== "line" && item.type !== "arrow") || item.deleted) continue;
    const next = rerouted(item, byId);
    if (next !== null) out.push(revise ? reviseItem(next) : next);
  }
  return out;
}

// A line moved on its own lets go of the items that stay put.
export function detached(line: LineItem, moving: ReadonlySet<string>): LineItem {
  const keep = (id: string | null): string | null => (id !== null && moving.has(id) ? id : null);
  return { ...line, ends: [keep(line.ends[0]), keep(line.ends[1])] };
}
