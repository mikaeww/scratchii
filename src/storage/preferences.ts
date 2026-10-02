// Per-device preferences: interface language, dot grid and the last used style. A convenience: when storage
// is blocked the defaults apply and nothing breaks.
import { COLORS, SIZES, type Color, type Size } from "../model/item.ts";

const KEY = "scratchii.preferences";

export interface StylePreference {
  readonly color: Color;
  readonly fill: Color | null;
  readonly size: Size;
}

export interface Preferences {
  readonly language: "system" | "en" | "de";
  readonly grid: boolean;
  readonly style: StylePreference | null;
}

const DEFAULTS: Preferences = { language: "system", grid: false, style: null };

function style(value: unknown): StylePreference | null {
  const stored = value as Partial<StylePreference> | null;
  const color = COLORS.find((c) => c === stored?.color);
  const size = SIZES.find((s) => s === stored?.size);
  const fill = stored?.fill === null ? null : COLORS.find((c) => c === stored?.fill);
  return color === undefined || size === undefined || fill === undefined ? null : { color, fill, size };
}

export function readPreferences(): Preferences {
  try {
    const stored = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Partial<Preferences> | null;
    const language = stored?.language === "en" || stored?.language === "de" ? stored.language : "system";
    return { language, grid: stored?.grid === true, style: style(stored?.style) };
  } catch {
    // Blocked or hand-edited storage: the defaults are always safe.
    return DEFAULTS;
  }
}

export function writePreferences(changes: Partial<Preferences>): boolean {
  try {
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
