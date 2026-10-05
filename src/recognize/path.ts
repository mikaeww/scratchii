// Measuring and resampling a pen path, shared by the shape and polygon recognisers. Not here: classifying.
export type Point = readonly [number, number];

export function distance(a: Point, b: Point): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

export function pathLength(points: readonly Point[]): number {
  let length = 0;
  for (let i = 1; i < points.length; i++)
    length += distance(points[i - 1] ?? points[i] ?? [0, 0], points[i] ?? [0, 0]);
  return length;
}

// Evenly spaced points along the path, so fast and slow parts of a stroke weigh the same.
export function resample(points: readonly Point[], count: number): Point[] {
  const total = pathLength(points);
  const first = points[0];
  if (first === undefined || total === 0) return first === undefined ? [] : [first];
  const step = total / (count - 1);
  const out: Point[] = [first];
  let carried = 0;
  for (let i = 1; i < points.length && out.length < count; i++) {
    let a = points[i - 1] ?? first;
    const b = points[i] ?? a;
    let segment = distance(a, b);
    while (carried + segment >= step && out.length < count) {
      const t = (step - carried) / segment;
      a = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
      out.push(a);
      segment = distance(a, b);
      carried = 0;
    }
    carried += segment;
  }
  const last = points.at(-1) ?? first;
  while (out.length < count) out.push(last);
  return out;
}
