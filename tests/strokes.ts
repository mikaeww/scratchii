// Generated hand-like strokes for the recogniser: jitter, wobble, overshoot and gaps like a quick mouse or pen
// stroke. A model of a hand, not a recording; see docs/verification/recognize.md.
import { controlPoint, curvePoints } from "../src/geometry/outline.ts";
import { between, pick, type Random } from "./random.ts";

export type Point = readonly [number, number];

export interface Sample {
  readonly points: Point[];
  readonly box?: { x: number; y: number; width: number; height: number };
  readonly ends?: readonly [Point, Point];
  readonly corners?: readonly Point[];
  readonly bend?: number;
}

function jitter(random: Random, points: Point[], amount: number): Point[] {
  let dx = 0;
  let dy = 0;
  // Smooth drift plus small noise: hands wander, they do not teleport.
  return points.map(([x, y]) => {
    dx = dx * 0.85 + between(random, -amount, amount) * 0.3;
    dy = dy * 0.85 + between(random, -amount, amount) * 0.3;
    return [x + dx + between(random, -amount, amount) * 0.2, y + dy + between(random, -amount, amount) * 0.2];
  });
}

function segment(a: Point, b: Point, count: number): Point[] {
  return Array.from({ length: count }, (_, i) => [
    a[0] + ((b[0] - a[0]) * i) / count,
    a[1] + ((b[1] - a[1]) * i) / count,
  ]);
}

function size(random: Random): number {
  return between(random, 60, 600);
}

export function line(random: Random): Sample {
  const length = size(random);
  const angle = random() * Math.PI * 2;
  const from: Point = [between(random, -500, 500), between(random, -500, 500)];
  const to: Point = [from[0] + Math.cos(angle) * length, from[1] + Math.sin(angle) * length];
  const bow = between(random, -0.03, 0.03) * length;
  const points = Array.from({ length: 40 }, (_, i): Point => {
    const t = i / 39;
    const sag = Math.sin(t * Math.PI) * bow;
    return [
      from[0] + (to[0] - from[0]) * t - Math.sin(angle) * sag,
      from[1] + (to[1] - from[1]) * t + Math.cos(angle) * sag,
    ];
  });
  return { points: jitter(random, points, length * 0.006), ends: [from, to] };
}

export function arrow(random: Random): Sample {
  const shaft = line(random);
  const [from, to] = shaft.ends ?? [
    [0, 0],
    [1, 1],
  ];
  const angle = Math.atan2(to[1] - from[1], to[0] - from[0]);
  const head = Math.hypot(to[0] - from[0], to[1] - from[1]) * between(random, 0.15, 0.3);
  const wing = (side: number): Point => [
    to[0] + Math.cos(angle + Math.PI + side * 0.5) * head,
    to[1] + Math.sin(angle + Math.PI + side * 0.5) * head,
  ];
  const points = [
    ...shaft.points,
    ...segment(to, wing(1), 8),
    ...segment(wing(1), to, 8),
    ...segment(to, wing(-1), 8),
    wing(-1),
  ];
  return { points: jitter(random, points, head * 0.02), ends: [from, to] };
}

export function ellipse(random: Random): Sample {
  const width = size(random);
  const height = width * between(random, 0.4, 1.6);
  const box = { x: between(random, -500, 500), y: between(random, -500, 500), width, height };
  const start = random() * Math.PI * 2;
  const sweep = Math.PI * 2 * between(random, 0.95, 1.08);
  const points = Array.from({ length: 60 }, (_, i): Point => {
    const t = start + (sweep * i) / 59;
    const wobble = 1 + between(random, -0.03, 0.03);
    return [
      box.x + width / 2 + (Math.cos(t) * width * wobble) / 2,
      box.y + height / 2 + (Math.sin(t) * height * wobble) / 2,
    ];
  });
  return { points: jitter(random, points, Math.min(width, height) * 0.01), box };
}

export function rect(random: Random): Sample {
  const width = size(random);
  const height = width * between(random, 0.3, 1.8);
  const box = { x: between(random, -500, 500), y: between(random, -500, 500), width, height };
  const corners: Point[] = [
    [box.x, box.y],
    [box.x + width, box.y],
    [box.x + width, box.y + height],
    [box.x, box.y + height],
  ];
  const points = closedPath(random, corners, 15);
  return { points: jitter(random, points, Math.min(width, height) * 0.01), box };
}

// One pass through the corners, starting at a random one, with a little overshoot past the start.
function closedPath(random: Random, corners: readonly Point[], perEdge: number): Point[] {
  const first = Math.floor(random() * corners.length);
  const order = Array.from(
    { length: corners.length + 1 },
    (_, i): Point => corners[(first + i) % corners.length] ?? [0, 0],
  );
  const points = order.slice(1).flatMap((corner, i) => segment(order[i] ?? corner, corner, perEdge));
  const overshoot = between(random, -0.05, 0.08);
  const last = order.at(-1) ?? [0, 0];
  const next = order[1] ?? last;
  points.push(last, [last[0] + (next[0] - last[0]) * overshoot, last[1] + (next[1] - last[1]) * overshoot]);
  return points;
}

function spot(random: Random): Point {
  return [between(random, -500, 500), between(random, -500, 500)];
}

// Any triangle at least 80 units across whose angles are all at least 25°, drawn in either direction.
export function triangle(random: Random): Sample {
  for (;;) {
    const [x, y] = spot(random);
    const span = size(random);
    const corners: Point[] = Array.from({ length: 3 }, () => [x + random() * span, y + random() * span]);
    const angles = corners.map((corner, i) => {
      const a = corners[(i + 1) % 3] ?? corner;
      const b = corners[(i + 2) % 3] ?? corner;
      const u = Math.atan2(a[1] - corner[1], a[0] - corner[0]);
      const v = Math.atan2(b[1] - corner[1], b[0] - corner[0]);
      const angle = Math.abs(u - v) % (2 * Math.PI);
      return Math.min(angle, 2 * Math.PI - angle);
    });
    const xs = corners.map(([cx]) => cx);
    const ys = corners.map(([, cy]) => cy);
    const across = Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
    if (Math.min(...angles) < (25 * Math.PI) / 180 || across < 80) continue;
    const drawn = random() < 0.5 ? corners : [...corners].reverse();
    return { points: jitter(random, closedPath(random, drawn, 20), span * 0.008), corners };
  }
}

export function diamond(random: Random): Sample {
  const width = size(random);
  const height = width * between(random, 0.5, 1.6);
  const box = { x: between(random, -500, 500), y: between(random, -500, 500), width, height };
  const corners: Point[] = [
    [box.x + width / 2, box.y],
    [box.x + width, box.y + height / 2],
    [box.x + width / 2, box.y + height],
    [box.x, box.y + height / 2],
  ];
  return { points: jitter(random, closedPath(random, corners, 15), Math.min(width, height) * 0.008), box };
}

// A five-pointed star the way most people draw it: one stroke from point to point, crossing itself.
export function star(random: Random): Sample {
  const radius = size(random) / 2;
  const [cx, cy] = spot(random);
  const tips = Array.from({ length: 5 }, (_, i): Point => {
    const angle = -Math.PI / 2 + (i * 4 * Math.PI) / 5;
    return [cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius];
  });
  const points = closedPath(random, tips, 14);
  const xs = tips.map(([x]) => x);
  const ys = tips.map(([, y]) => y);
  const box = {
    x: Math.min(...xs),
    y: Math.min(...ys),
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys),
  };
  return { points: jitter(random, points, radius * 0.012), box };
}

// A box leaning by an angle in [low, high] degrees (either way), each corner off by up to 4 % of the short side.
export function leaningBox(random: Random, low: number, high: number): Sample & { lean: number } {
  const width = size(random);
  const height = width * between(random, 0.4, 1.6);
  const [cx, cy] = spot(random);
  const lean = (between(random, low, high) * (random() < 0.5 ? -1 : 1) * Math.PI) / 180;
  const slack = Math.min(width, height) * 0.04;
  const corners = [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ].map(([sx = 0, sy = 0]): Point => {
    const [x, y] = [(sx * width) / 2, (sy * height) / 2];
    return [
      cx + x * Math.cos(lean) - y * Math.sin(lean) + between(random, -slack, slack),
      cy + x * Math.sin(lean) + y * Math.cos(lean) + between(random, -slack, slack),
    ];
  });
  return { points: jitter(random, closedPath(random, corners, 15), slack / 4), corners, lean };
}

// A triangle on a base that leans up to 6°, its apex within 5 % of the base length from the middle.
export function baseTriangle(random: Random): Sample {
  const base = size(random);
  const [x, y] = spot(random);
  const tilt = base * Math.tan((between(random, -6, 6) * Math.PI) / 180);
  const corners: Point[] = [
    [x, y],
    [x + base, y + tilt],
    [x + base * between(random, 0.45, 0.55), y - base * between(random, 0.6, 1.1)],
  ];
  return { points: jitter(random, closedPath(random, corners, 20), base * 0.006), corners };
}

// The wings of a head at `tip`, pointing along `angle`, drawn out and back like a hand does.
function headWings(random: Random, tip: Point, angle: number, size: number): Point[] {
  const wing = (side: number): Point => [
    tip[0] + Math.cos(angle + Math.PI + side * 0.5) * size,
    tip[1] + Math.sin(angle + Math.PI + side * 0.5) * size,
  ];
  return [...segment(tip, wing(1), 8), ...segment(wing(1), tip, 8), ...segment(tip, wing(-1), 8), wing(-1)];
}

// A line with one bend between 0.12 and 0.5 chord lengths, either way; with a head at its end when `pointed`.
export function curved(random: Random, pointed: boolean): Sample {
  const length = size(random);
  const angle = random() * Math.PI * 2;
  const from: Point = spot(random);
  const to: Point = [from[0] + Math.cos(angle) * length, from[1] + Math.sin(angle) * length];
  const bend = between(random, 0.12, 0.5) * (random() < 0.5 ? -1 : 1);
  const curve = curvePoints(from, to, bend, 40);
  const [cx, cy] = controlPoint(from, to, bend);
  const points = pointed
    ? [...curve, ...headWings(random, to, Math.atan2(to[1] - cy, to[0] - cx), length * 0.2)]
    : curve;
  return { points: jitter(random, points, length * 0.005), ends: [from, to], bend };
}

// An arrow in two strokes: the shaft (straight or bent) and, separately, the head as a "V" at its end.
export function twoStrokeArrow(random: Random): Sample & { readonly head: Point[] } {
  const shaft = random() < 0.5 ? line(random) : curved(random, false);
  const [from, to] = shaft.ends ?? [
    [0, 0],
    [1, 1],
  ];
  const before = shaft.points.at(-4) ?? from;
  const angle = Math.atan2(to[1] - before[1], to[0] - before[0]);
  const size = Math.hypot(to[0] - from[0], to[1] - from[1]) * between(random, 0.12, 0.3);
  const opening = between(random, 0.35, 0.8);
  const wing = (side: number): Point => [
    to[0] + Math.cos(angle + Math.PI + side * opening) * size,
    to[1] + Math.sin(angle + Math.PI + side * opening) * size,
  ];
  const head = jitter(
    random,
    [...segment(wing(1), to, 10), ...segment(to, wing(-1), 10), wing(-1)],
    size * 0.02,
  );
  return { ...shaft, head };
}

const NOT_SHAPES = {
  scribble: (random: Random): Point[] => {
    const points: Point[] = [[0, 0]];
    for (let i = 0; i < 60; i++) {
      const [x, y] = points.at(-1) ?? [0, 0];
      points.push([x + between(random, -40, 40), y + between(random, -40, 40)]);
    }
    return points;
  },
  wave: (random: Random): Point[] => {
    const amplitude = between(random, 20, 60);
    return Array.from({ length: 60 }, (_, i) => [i * 8, Math.sin(i / 4) * amplitude]);
  },
  spiral: (random: Random): Point[] => {
    const turns = between(random, 2, 4);
    return Array.from({ length: 80 }, (_, i) => {
      const t = (i / 79) * turns * Math.PI * 2;
      return [Math.cos(t) * (10 + t * 12), Math.sin(t) * (10 + t * 12)];
    });
  },
  zigzag: (random: Random): Point[] => {
    const height = between(random, 30, 120);
    return Array.from({ length: 9 }, (_, i) => [i * 30, i % 2 === 0 ? 0 : height]).flatMap(
      ([x = 0, y = 0], i, all) => {
        const next = all[i + 1];
        return next === undefined ? [[x, y] as Point] : segment([x, y], [next[0] ?? 0, next[1] ?? 0], 6);
      },
    );
  },
  letterS: (): Point[] =>
    Array.from({ length: 50 }, (_, i) => {
      const t = (i / 49) * Math.PI * 2;
      return [Math.sin(t) * 30 * (t < Math.PI ? 1 : -1), (i / 49) * 100];
    }),
  letterM: (): Point[] => [
    ...segment([0, 100], [0, 0], 10),
    ...segment([0, 0], [30, 80], 10),
    ...segment([30, 80], [60, 0], 10),
    ...segment([60, 0], [60, 100], 10),
  ],
  letterZ: (): Point[] => [
    ...segment([0, 0], [80, 0], 10),
    ...segment([80, 0], [0, 100], 12),
    ...segment([0, 100], [80, 100], 10),
  ],
} as const;

export const NOT_SHAPE_KINDS = Object.keys(NOT_SHAPES) as (keyof typeof NOT_SHAPES)[];

export function notShape(random: Random, kind: keyof typeof NOT_SHAPES): Point[] {
  const scale = between(random, 0.7, 2);
  return jitter(
    random,
    NOT_SHAPES[kind](random).map(([x, y]) => [x * scale, y * scale]),
    2,
  );
}

export { pick };
