// Turns untrusted JSON (files, clipboard, IndexedDB, sync requests) into a Board or fails with the exact path.
// Not here: migrations between format versions; an unknown shape is an error, never a guess.
import type { Board } from "./board.ts";
import {
  COLORS,
  ITEM_TYPES,
  SIZES,
  type Color,
  type Item,
  type ItemBase,
  type ItemType,
  type LineItem,
  type MarkItem,
  type MarkStroke,
  type ShapeItem,
  type StrokePoint,
} from "./item.ts";

export class ValidationError extends Error {
  readonly path: string;
  constructor(path: string, problem: string) {
    super(`${path}: ${problem}`);
    this.name = "ValidationError";
    this.path = path;
  }
}

const MAX_TEXT = 100_000;
const MAX_POINTS = 100_000;

type Fields = Record<string, unknown>;

function object(value: unknown, path: string): Fields {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ValidationError(path, "expected an object");
  }
  return value as Fields;
}

function record(value: unknown, path: string, keys: readonly string[]): Fields {
  const fields = object(value, path);
  for (const key of Object.keys(fields)) {
    if (!keys.includes(key)) throw new ValidationError(`${path}.${key}`, "unknown field");
  }
  for (const key of keys) {
    if (!(key in fields)) throw new ValidationError(`${path}.${key}`, "missing");
  }
  return fields;
}

function finite(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isFinite(value))
    throw new ValidationError(path, "expected a number");
  return value;
}

function integer(value: unknown, path: string): number {
  const number = finite(value, path);
  if (!Number.isSafeInteger(number) || number < 0) throw new ValidationError(path, "expected an integer ≥ 0");
  return number;
}

function text(value: unknown, path: string): string {
  if (typeof value !== "string" || value.length > MAX_TEXT)
    throw new ValidationError(path, "expected a string");
  return value;
}

function flag(value: unknown, path: string): boolean {
  if (typeof value !== "boolean") throw new ValidationError(path, "expected true or false");
  return value;
}

function oneOf<T extends string>(value: unknown, path: string, allowed: readonly T[]): T {
  if (!allowed.includes(value as T)) throw new ValidationError(path, `expected one of ${allowed.join(", ")}`);
  return value as T;
}

function list<T>(value: unknown, path: string, read: (v: unknown, p: string) => T, max = MAX_POINTS): T[] {
  if (!Array.isArray(value)) throw new ValidationError(path, "expected a list");
  if (value.length > max) throw new ValidationError(path, `more than ${max} entries`);
  return value.map((entry, index) => read(entry, `${path}[${index}]`));
}

function strokePoint(value: unknown, path: string): StrokePoint {
  const [x, y, pressure] = list(value, path, finite, 3);
  if (x === undefined || y === undefined || pressure === undefined) {
    throw new ValidationError(path, "expected [x, y, pressure]");
  }
  if (pressure < 0 || pressure > 1) throw new ValidationError(`${path}[2]`, "pressure outside 0 to 1");
  return [x, y, pressure];
}

const BASE_KEYS = ["id", "type", "x", "y", "color", "size", "seed", "version", "nonce", "deleted", "updated"];

function base(fields: Fields, path: string): ItemBase {
  return {
    id: text(fields.id, `${path}.id`),
    x: finite(fields.x, `${path}.x`),
    y: finite(fields.y, `${path}.y`),
    color: oneOf(fields.color, `${path}.color`, COLORS),
    size: oneOf(fields.size, `${path}.size`, SIZES),
    seed: integer(fields.seed, `${path}.seed`),
    version: integer(fields.version, `${path}.version`),
    nonce: integer(fields.nonce, `${path}.nonce`),
    deleted: flag(fields.deleted, `${path}.deleted`),
    updated: integer(fields.updated, `${path}.updated`),
  };
}

function positive(value: unknown, path: string): number {
  const number = finite(value, path);
  if (number < 0) throw new ValidationError(path, "expected a number ≥ 0");
  return number;
}

function linePoint(value: unknown, path: string): readonly [number, number] {
  const [x, y, ...rest] = list(value, path, finite, 2);
  if (x === undefined || y === undefined || rest.length > 0)
    throw new ValidationError(path, "expected [x, y]");
  return [x, y];
}

function linePoints(value: unknown, path: string): LineItem["points"] {
  const [start, end] = list(value, path, linePoint, 2);
  if (start === undefined || end === undefined) throw new ValidationError(path, "expected [start, end]");
  return [start, end];
}

function markStroke(value: unknown, path: string): MarkStroke {
  const fields = record(value, path, ["points", "weight"]);
  return {
    points: list(fields.points, `${path}.points`, linePoint),
    weight: fields.weight === null ? null : positive(fields.weight, `${path}.weight`),
  };
}

function lineRange(value: unknown, path: string): MarkItem["lines"] {
  if (value === null) return null;
  const [first, last, ...rest] = list(value, path, integer, 2);
  if (first === undefined || last === undefined || rest.length > 0 || first > last) {
    throw new ValidationError(path, "expected [first, last] with first ≤ last");
  }
  return [first, last];
}

function nullableColor(value: unknown, path: string): Color | null {
  return value === null ? null : oneOf(value, path, COLORS);
}

type Reader = (fields: Fields, path: string) => Omit<Item, keyof ItemBase>;

const READERS: Readonly<Record<ItemType, readonly [readonly string[], Reader]>> = {
  stroke: [
    ["points", "pressure"],
    (f, p) => ({
      type: "stroke",
      points: list(f.points, `${p}.points`, strokePoint),
      pressure: flag(f.pressure, `${p}.pressure`),
    }),
  ],
  rect: [["width", "height", "fill"], (f, p) => shape("rect", f, p)],
  ellipse: [["width", "height", "fill"], (f, p) => shape("ellipse", f, p)],
  line: [["points"], (f, p) => ({ type: "line", points: linePoints(f.points, `${p}.points`) })],
  arrow: [["points"], (f, p) => ({ type: "arrow", points: linePoints(f.points, `${p}.points`) })],
  text: [
    ["text", "fontSize", "width", "height"],
    (f, p) => ({
      type: "text",
      text: text(f.text, `${p}.text`),
      fontSize: positive(f.fontSize, `${p}.fontSize`),
      width: positive(f.width, `${p}.width`),
      height: positive(f.height, `${p}.height`),
    }),
  ],
  mark: [
    ["target", "lines", "layer", "fit", "strokes"],
    (f, p) => ({
      type: "mark",
      target: text(f.target, `${p}.target`),
      lines: lineRange(f.lines, `${p}.lines`),
      layer: oneOf(f.layer, `${p}.layer`, ["over", "behind"] as const),
      fit: oneOf(f.fit, `${p}.fit`, ["stretch", "repeat"] as const),
      strokes: list(f.strokes, `${p}.strokes`, markStroke, 64),
    }),
  ],
  note: [
    ["text", "width", "height", "fill"],
    (f, p) => ({
      type: "note",
      text: text(f.text, `${p}.text`),
      width: positive(f.width, `${p}.width`),
      height: positive(f.height, `${p}.height`),
      fill: oneOf(f.fill, `${p}.fill`, COLORS),
    }),
  ],
};

function shape(type: ShapeItem["type"], fields: Fields, path: string): Omit<ShapeItem, keyof ItemBase> {
  return {
    type,
    width: positive(fields.width, `${path}.width`),
    height: positive(fields.height, `${path}.height`),
    fill: nullableColor(fields.fill, `${path}.fill`),
  };
}

export function validateItem(value: unknown, path: string): Item {
  const type = oneOf(object(value, path).type, `${path}.type`, ITEM_TYPES);
  const [keys, read] = READERS[type];
  const fields = record(value, path, [...BASE_KEYS, ...keys]);
  return { ...base(fields, path), ...read(fields, path) } as Item;
}

export function validateBoard(value: unknown, path = "board"): Board {
  const fields = record(value, path, ["id", "title", "tags", "created", "updated", "items"]);
  return {
    id: text(fields.id, `${path}.id`),
    title: text(fields.title, `${path}.title`),
    tags: list(fields.tags, `${path}.tags`, text, 100),
    created: integer(fields.created, `${path}.created`),
    updated: integer(fields.updated, `${path}.updated`),
    items: list(fields.items, `${path}.items`, validateItem),
  };
}
