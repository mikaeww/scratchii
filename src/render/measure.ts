// Measures and wraps handwritten text with the real font. Needs a browser; not used by the pure geometry.
import { LINE_HEIGHT } from "../geometry/widths.ts";

let context: OffscreenCanvasRenderingContext2D | null = null;

export class MeasureUnavailableError extends Error {
  constructor() {
    super("This browser cannot measure text on an offscreen canvas.");
    this.name = "MeasureUnavailableError";
  }
}

export function handFont(fontSize: number): string {
  return `500 ${fontSize}px "Shantell Sans"`;
}

function measurer(): OffscreenCanvasRenderingContext2D {
  context ??= new OffscreenCanvas(1, 1).getContext("2d");
  if (context === null) throw new MeasureUnavailableError();
  return context;
}

export function lineWidth(line: string, fontSize: number): number {
  const ctx = measurer();
  ctx.font = handFont(fontSize);
  return ctx.measureText(line).width;
}

export function measureBlock(text: string, fontSize: number): { width: number; height: number } {
  const lines = text.split("\n");
  const width = Math.max(...lines.map((line) => lineWidth(line, fontSize)));
  return { width: Math.ceil(width), height: Math.ceil(lines.length * fontSize * LINE_HEIGHT) };
}

// Greedy word wrap; a single word wider than the line is left whole rather than split mid-word.
export function wrapText(text: string, fontSize: number, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    let line = "";
    for (const word of paragraph.split(" ")) {
      const candidate = line === "" ? word : `${line} ${word}`;
      if (line !== "" && lineWidth(candidate, fontSize) > maxWidth) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    lines.push(line);
  }
  return lines;
}
