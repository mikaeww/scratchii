// Per-device preferences: interface language, paper background and the last used style. A convenience: when storage
// is blocked the defaults apply and nothing breaks.
import { COLORS, SIZES, type Color, type Size } from "../model/item.ts";
import { PAPERS, type Paper } from "../render/canvas.ts";

const KEY = "scratchii.preferences";

export interface StylePreference {
  readonly color: Color;
  readonly fill: Color | null;
  readonly size: Size;
}

export interface Preferences {
  readonly language: "system" | "en" | "de";
  readonly paper: Paper;
  readonly style: StylePreference | null;
}

const DEFAULTS: Preferences = { language: "system", paper: "plain", style: null };

// Before papers there was only a dot grid, stored as `grid: true`.
function paper(stored: { paper?: unknown; grid?: unknown } | null): Paper {
  const chosen = PAPERS.find((p) => p === stored?.paper);
  if (chosen !== undefined) return chosen;
  return stored?.grid === true ? "dots" : "plain";
}

function style(value: unknown): StylePreference | null {
  const stored = value as Partial<StylePreference> | null;
  const color = COLORS.find((c) => c === stored?.color);
  const size = SIZES.find((s) => s === stored?.size);
  const fill = stored?.fill === null ? null : COLORS.find((c) => c === stored?.fill);
  return color === undefined || size === undefined || fill === undefined ? null : { color, fill, size };
}

export function readPreferences(): Preferences {
  try {
    const stored = JSON.parse(localStorage.getItem(KEY) ?? "{}") as
      (Partial<Preferences> & { grid?: unknown }) | null;
    const language = stored?.language === "en" || stored?.language === "de" ? stored.language : "system";
    return { language, paper: paper(stored), style: style(stored?.style) };
  } catch {
    // Blocked or hand-edited storage: the defaults are always safe.
    return DEFAULTS;
  }
}

export function writePreferences(changes: Partial<Preferences>): boolean {
  try {
    // The old grid flag is not written back; `paper` replaces it.
    localStorage.setItem(KEY, JSON.stringify({ ...readPreferences(), ...changes }));
    return true;
  } catch {
    return false;
  }
}

// Starts the editor with the style used last time and remembers every change of it.
export function rememberStyle(editor: {
  style: StylePreference;
  setStyle: (style: StylePreference) => void;
  on: (listener: (change: string) => void) => unknown;
}): void {
  const remembered = readPreferences().style;
  if (remembered !== null) editor.setStyle(remembered);
  editor.on((change) => {
    if (change === "style") writePreferences({ style: editor.style });
  });
}
