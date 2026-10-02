// A dialog to draw an own mark over a guide word. The strokes are normalised to the word's line box, applied
// to the text that was right-clicked, and kept as a preset in this browser.
import { loadOwnMarks, normaliseStrokes, saveOwnMarks } from "../../annotate/custom.ts";
import { markColor, type PresetShape } from "../../annotate/presets.ts";
import type { Editor } from "../../editor/editor.ts";
import { LINE_HEIGHT } from "../../geometry/widths.ts";
import { createItem, type StrokeItem, type TextItem } from "../../model/item.ts";
import { drawScene } from "../../render/canvas.ts";
import type { Ink } from "../../render/ink.ts";
import { measureBlock } from "../../render/measure.ts";
import { text, type TextKey } from "../text.ts";
import { showToast } from "../toast.ts";
import { markFor } from "./preview.ts";

// CSS pixels of the drawing area and the guide word's font size in it.
const WIDTH = 520;
const HEIGHT = 200;
const GUIDE_SIZE = 64;

type Points = [number, number][];

function button(label: TextKey, primary: boolean): HTMLButtonElement {
  const element = document.createElement("button");
  element.type = "button";
  element.className = primary ? "button primary" : "button";
  element.textContent = text(label);
  return element;
}

function guideText(): TextItem {
  const block = measureBlock(text("pad.guide"), GUIDE_SIZE);
  return createItem<TextItem>({
    type: "text",
    x: (WIDTH - block.width) / 2,
    y: (HEIGHT - block.height) / 2,
    color: "ink",
    size: "m",
    text: text("pad.guide"),
    fontSize: GUIDE_SIZE,
    ...block,
  });
}

function strokeItem(points: Points, editor: Editor, behind: boolean): StrokeItem {
  const color = markColor(editor.style.color, behind ? "behind" : "over");
  return createItem<StrokeItem>({
    type: "stroke",
    x: 0,
    y: 0,
    color,
    size: "m",
    points: points.map(([x, y]) => [x, y, 0.5]),
    pressure: false,
    tip: "pen",
  });
}

function layout(
  dialog: HTMLDialogElement,
  canvas: HTMLCanvasElement,
  behind: HTMLInputElement,
): HTMLButtonElement[] {
  const title = document.createElement("h2");
  title.className = "dialog-title";
  title.textContent = text("pad.title");
  const hint = document.createElement("p");
  hint.className = "dialog-hint";
  hint.textContent = text("pad.hint");
  const check = document.createElement("label");
  check.className = "check";
  check.append(behind, text("pad.behind"));
  const actions = document.createElement("div");
  actions.className = "dialog-actions";
  const buttons = [button("pad.clear", false), button("pad.cancel", false), button("pad.save", true)];
  actions.append(...buttons);
  dialog.append(title, hint, canvas, check, actions);
  return buttons;
}

function attachDrawing(canvas: HTMLCanvasElement, strokes: Points[], draw: () => void): void {
  canvas.addEventListener("pointerdown", (event) => {
    canvas.setPointerCapture(event.pointerId);
    strokes.push([[event.offsetX, event.offsetY]]);
    draw();
  });
  canvas.addEventListener("pointermove", (event) => {
    const current = strokes.at(-1);
    if (current === undefined || !canvas.hasPointerCapture(event.pointerId)) return;
    for (const sample of event.getCoalescedEvents()) current.push([sample.offsetX, sample.offsetY]);
    draw();
  });
}

export function mountMarkPad(editor: Editor, ink: Ink): (target: TextItem) => void {
  const dialog = document.createElement("dialog");
  dialog.className = "dialog";
  const canvas = document.createElement("canvas");
  canvas.className = "pad";
  const behind = document.createElement("input");
  behind.type = "checkbox";
  const [clear, cancel, save] = layout(dialog, canvas, behind);
  document.body.append(dialog);
  const strokes: Points[] = [];
  let target: TextItem | null = null;
  const guide = guideText();
  const context = canvas.getContext("2d");

  const draw = (): void => {
    const ratio = window.devicePixelRatio;
    canvas.width = WIDTH * ratio;
    canvas.height = HEIGHT * ratio;
    const drawn = strokes.filter((s) => s.length > 0).map((s) => strokeItem(s, editor, behind.checked));
    const items = behind.checked ? [...drawn, guide] : [guide, ...drawn];
    if (context !== null)
      drawScene(context, { items, view: { x: 0, y: 0, zoom: 1 }, width: WIDTH, height: HEIGHT, ratio }, ink);
  };

  attachDrawing(canvas, strokes, draw);
  behind.addEventListener("change", draw);
  clear?.addEventListener("click", () => {
    strokes.length = 0;
    draw();
  });
  cancel?.addEventListener("click", () => {
    dialog.close();
  });
  save?.addEventListener("click", () => {
    const lineBox = { x: guide.x, y: guide.y, width: guide.width, height: GUIDE_SIZE * LINE_HEIGHT };
    const preset: PresetShape = {
      layer: behind.checked ? "behind" : "over",
      fit: "stretch",
      strokes: normaliseStrokes(strokes, lineBox),
    };
    if (target !== null && preset.strokes.length > 0) {
      editor.commit([
        markFor(preset, target.id, markColor(editor.style.color, preset.layer), editor.style.size),
      ]);
      if (!saveOwnMarks([...loadOwnMarks(), { ...preset, id: "own" }]))
        showToast(text("pad.unsaved"), "error");
    }
    dialog.close();
  });

  return (next) => {
    target = next;
    strokes.length = 0;
    behind.checked = false;
    dialog.showModal();
    draw();
  };
}
