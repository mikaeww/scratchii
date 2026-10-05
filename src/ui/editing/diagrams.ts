// Diagrams from text: node sizes measured with the real font, the dialog request that builds and places the
// items, and the ready-made building blocks. Not here: reading the text or the layout (src/diagram).
import { buildDiagram } from "../../diagram/build.ts";
import { DiagramError, readFlowchart, type FlowNode } from "../../diagram/flowchart.ts";
import { insertAt } from "../../editor/commands.ts";
import type { Editor } from "../../editor/editor.ts";
import type { Vec } from "../../editor/viewport.ts";
import { LINE_HEIGHT, NOTE_FONT_SIZE } from "../../geometry/widths.ts";
import type { Size } from "../../model/item.ts";
import { lineWidth, wrapText } from "../../render/measure.ts";
import type { TextRequest } from "../menus/text-dialog.ts";
import { text } from "../text.ts";

// Text width inside a node before it wraps, the padding around it and the smallest node (world units).
const TEXT_WIDTH = 200;
const PAD = { x: 24, y: 18 } as const;
const SMALLEST = { width: 120, height: 64 } as const;

function sizeOf(node: FlowNode, size: Size): { width: number; height: number } {
  const fontSize = NOTE_FONT_SIZE[size];
  const lines = wrapText(node.label, fontSize, TEXT_WIDTH);
  const textWidth = Math.max(...lines.map((line) => lineWidth(line, fontSize)));
  const width = Math.max(SMALLEST.width, textWidth + 2 * PAD.x);
  const height = Math.max(SMALLEST.height, lines.length * fontSize * LINE_HEIGHT + 2 * PAD.y);
  // A diamond or an ellipse holds its text in a smaller inner box than a rectangle of the same size.
  if (node.shape === "decision") return { width: width * 1.5, height: height * 1.6 };
  if (node.shape === "circle")
    return { width: Math.max(width, height) * 1.2, height: Math.max(width, height) * 1.2 };
  if (node.shape === "round") return { width: width * 1.2, height: height * 1.15 };
  return { width, height };
}

export function placeDiagram(editor: Editor, source: string, at: Vec): void {
  const chart = readFlowchart(source);
  const { color, fill, size } = editor.style;
  insertAt(
    editor,
    buildDiagram(chart, (node) => sizeOf(node, size), { color, fill, size }),
    at,
  );
}

export function diagramRequest(editor: Editor, at: () => Vec, value: string): TextRequest {
  return {
    title: "diagram.title",
    hint: "diagram.hint",
    value,
    apply: (source) => {
      try {
        placeDiagram(editor, source, at());
        return null;
      } catch (error) {
        if (error instanceof DiagramError) return `${text("dialog.problem")} ${error.message}`;
        throw error;
      }
    },
  };
}
