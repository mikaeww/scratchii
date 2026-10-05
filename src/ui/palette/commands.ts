// Every command the palette offers. Each feature adds its own here; the palette itself only ranks and runs.
import type { Editor, ToolName } from "../../editor/editor.ts";
import type { Vec } from "../../editor/viewport.ts";
import { text } from "../text.ts";
import type { Command } from "./rank.ts";

export interface PaletteContext {
  readonly editor: Editor;
  // The world point in the middle of the visible canvas, where inserted things land.
  readonly centre: () => Vec;
}

const TOOL_WORDS: Readonly<Record<ToolName, readonly string[]>> = {
  select: ["auswählen", "select", "auswahl"],
  hand: ["hand", "verschieben", "pan"],
  pen: ["stift", "pen", "zeichnen", "draw"],
  marker: ["marker", "textmarker", "highlighter"],
  rect: ["rechteck", "rectangle", "box", "kasten", "quadrat", "square"],
  ellipse: ["kreis", "circle", "ellipse", "oval"],
  triangle: ["dreieck", "triangle"],
  diamond: ["raute", "diamond", "rhombus", "entscheidung"],
  star: ["stern", "star"],
  line: ["linie", "line", "strich"],
  arrow: ["pfeil", "arrow", "verbinder", "connector"],
  text: ["text", "schrift", "tippen", "type"],
  note: ["notiz", "zettel", "note", "sticky"],
  eraser: ["radierer", "radiergummi", "eraser"],
};

function toolCommands({ editor }: PaletteContext): Command[] {
  return (Object.keys(TOOL_WORDS) as ToolName[]).map((tool) => ({
    id: `tool.${tool}`,
    label: text(`tool.${tool}`),
    words: TOOL_WORDS[tool],
    run: () => {
      editor.setTool(tool);
    },
  }));
}

export function paletteCommands(context: PaletteContext): Command[] {
  return [...toolCommands(context)];
}
