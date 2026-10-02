// Reads the drawing palette and shadow offset from the CSS tokens in src/ui/theme.css, the single source.
// Not here: interface colours that never reach the canvas.
import { COLORS, type Color } from "../model/item.ts";

export interface Ink {
  readonly colors: Readonly<Record<Color, string>>;
  readonly canvas: string;
  // World units, so the shadow scales with zoom like the item.
  readonly shadow: readonly [x: number, y: number];
}

export class MissingTokenError extends Error {
  constructor(token: string) {
    super(`theme.css defines no ${token}`);
    this.name = "MissingTokenError";
  }
}

function token(style: CSSStyleDeclaration, name: string): string {
  const value = style.getPropertyValue(name).trim();
  if (value === "") throw new MissingTokenError(name);
  return value;
}

export function readInk(root: Element): Ink {
  const style = getComputedStyle(root);
  const colors = Object.fromEntries(COLORS.map((c) => [c, token(style, `--${c}`)])) as Record<Color, string>;
  const shadow = Number.parseFloat(token(style, "--canvas-shadow"));
  return { colors, canvas: token(style, "--canvas"), shadow: [shadow, shadow] };
}
