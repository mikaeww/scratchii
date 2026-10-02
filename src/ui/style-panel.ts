// The style panel on the left: ink colour, fill and size for new items and for the selection.
import { applyStyle } from "../editor/commands.ts";
import type { Editor, Style } from "../editor/editor.ts";
import type { Color, Size } from "../model/item.ts";
import { icon } from "./icons.ts";
import { text, type TextKey } from "./text.ts";

const INKS: readonly Color[] = ["ink", "paper", "coral", "violet", "teal", "sun", "pink", "orange", "sky"];
const FILLS: readonly (Color | null)[] = [
  null,
  "paper",
  "coral",
  "violet",
  "teal",
  "sun",
  "pink",
  "orange",
  "sky",
];
const SIZES: readonly Size[] = ["s", "m", "l"];

interface Choice {
  readonly button: HTMLButtonElement;
  readonly active: (style: Style) => boolean;
}

function swatch(
  color: Color | null,
  label: TextKey,
  change: Partial<Style>,
  editor: Editor,
): HTMLButtonElement {
  const button = document.createElement("button");
  button.className = "swatch";
  button.title = text(label);
  button.setAttribute("aria-label", text(label));
  if (color === null) button.append(icon("line"));
  else button.style.background = `var(--${color})`;
  button.addEventListener("click", () => {
    applyStyle(editor, change);
  });
  return button;
}

function section(label: TextKey, buttons: readonly HTMLButtonElement[], className: string): HTMLElement {
  const element = document.createElement("div");
  element.className = "style-section";
  const heading = document.createElement("span");
  heading.className = "label";
  heading.textContent = text(label);
  const grid = document.createElement("div");
  grid.className = className;
  grid.setAttribute("role", "group");
  grid.setAttribute("aria-label", text(label));
  grid.append(...buttons);
  element.append(heading, grid);
  return element;
}

export function stylePanel(editor: Editor): HTMLElement {
  const panel = document.createElement("div");
  panel.className = "panel left style-panel";
  panel.setAttribute("aria-label", text("style.label"));
  const inks: Choice[] = INKS.map((color) => ({
    button: swatch(color, `color.${color}`, { color }, editor),
    active: (style) => style.color === color,
  }));
  const fills: Choice[] = FILLS.map((fill) => ({
    button: swatch(fill, fill === null ? "style.none" : `color.${fill}`, { fill }, editor),
    active: (style) => style.fill === fill,
  }));
  const sizes: Choice[] = SIZES.map((size) => {
    const button = document.createElement("button");
    button.className = "button";
    button.textContent = size.toUpperCase();
    button.title = text(`size.${size}`);
    button.setAttribute("aria-label", text(`size.${size}`));
    button.addEventListener("click", () => {
      applyStyle(editor, { size });
    });
    return { button, active: (style: Style) => style.size === size };
  });
  const sync = (): void => {
    for (const choice of [...inks, ...fills, ...sizes]) {
      choice.button.setAttribute("aria-pressed", String(choice.active(editor.style)));
    }
  };
  editor.on((change) => {
    if (change === "style") sync();
  });
  sync();
  panel.append(
    section(
      "style.ink",
      inks.map((c) => c.button),
      "swatches",
    ),
    section(
      "style.fill",
      fills.map((c) => c.button),
      "swatches",
    ),
    section(
      "style.size",
      sizes.map((c) => c.button),
      "sizes",
    ),
  );
  return panel;
}
