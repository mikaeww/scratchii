// Small canvases that show a mark on a sample word, drawn by the real renderer.
import type { PresetShape } from "../../annotate/presets.ts";
import { createItem, type MarkItem, type TextItem } from "../../model/item.ts";
import { drawScene } from "../../render/canvas.ts";
import type { Ink } from "../../render/ink.ts";
import { measureBlock } from "../../render/measure.ts";
import type { Color } from "../../model/item.ts";

const WORD = "Abcdef";
const FONT_SIZE = 18;
// CSS pixels of the preview canvas.
const WIDTH = 96;
const HEIGHT = 40;

export function markFor(preset: PresetShape, target: string, color: Color, size: MarkItem["size"]): MarkItem {
  return createItem<MarkItem>({ type: "mark", x: 0, y: 0, color, size, target, lines: null, ...preset });
}

export function markPreview(preset: PresetShape, color: Color, ink: Ink): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  // Decorative: the button around it carries the name.
  canvas.setAttribute("aria-hidden", "true");
  const ratio = window.devicePixelRatio;
  canvas.width = WIDTH * ratio;
  canvas.height = HEIGHT * ratio;
  canvas.style.width = `${WIDTH}px`;
  canvas.style.height = `${HEIGHT}px`;
  const context = canvas.getContext("2d");
  if (context === null) return canvas;
  const block = measureBlock(WORD, FONT_SIZE);
  const text = createItem<TextItem>({
    type: "text",
    x: (WIDTH - block.width) / 2,
    y: (HEIGHT - block.height) / 2,
    color: "ink",
    size: "s",
    text: WORD,
    fontSize: FONT_SIZE,
    ...block,
  });
  const scene = {
    items: [text, markFor(preset, text.id, color, "s")],
    view: { x: 0, y: 0, zoom: 1 },
    width: WIDTH,
    height: HEIGHT,
    ratio,
  };
  drawScene(context, scene, ink);
  return canvas;
}
