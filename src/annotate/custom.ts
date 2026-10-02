// Own marks: strokes drawn over a guide word are normalised into a preset, and kept per browser.
// The board never depends on this list: every mark item carries its own strokes.
import type { Box } from "../geometry/box.ts";
import type { MarkStroke } from "../model/item.ts";
import { validateItem } from "../model/validate.ts";
import type { Preset } from "./presets.ts";

const STORAGE_KEY = "scratchii.ownMarks";

export function normaliseStrokes(
  drawn: readonly (readonly (readonly [number, number])[])[],
  guide: Box,
): MarkStroke[] {
  return drawn
    .filter((points) => points.length > 1)
    .map((points) => ({
      points: points.map(([x, y]) => [(x - guide.x) / guide.width, (y - guide.y) / guide.height] as const),
      weight: null,
    }));
}

// The list lives in localStorage, which can be missing, full or hand-edited: unreadable entries are dropped
// with a console note, never guessed at.
export function loadOwnMarks(): Preset[] {
  let raw: string | null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    return [];
  }
  if (raw === null) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error("not a list");
    return parsed.map((entry: unknown, index) => {
      const probe = {
        id: `own-${index}`,
        type: "mark",
        x: 0,
        y: 0,
        color: "ink",
        size: "m",
        seed: 0,
        version: 1,
        nonce: 0,
        deleted: false,
        updated: 0,
        target: "",
        lines: null,
        ...(entry as object),
      };
      const mark = validateItem(probe, `ownMarks[${index}]`);
      if (mark.type !== "mark") throw new Error(`ownMarks[${index}] is not a mark`);
      return { id: `own-${index}`, layer: mark.layer, fit: mark.fit, strokes: mark.strokes };
    });
  } catch (error) {
    console.warn("Ignoring unreadable own marks", error);
    return [];
  }
}

export function saveOwnMarks(presets: readonly Preset[]): boolean {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(presets.map(({ layer, fit, strokes }) => ({ layer, fit, strokes }))),
    );
    return true;
  } catch {
    return false;
  }
}
