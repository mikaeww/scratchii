// The marker: a wide translucent stroke. Drawn over a line of text it becomes a highlight mark on that text
// (src/recognize/highlight.ts), so it follows the text from then on.
import { markColor } from "../../annotate/presets.ts";
import type { Box } from "../../geometry/box.ts";
import { createItem, type MarkItem, type StrokeItem, type TextItem } from "../../model/item.ts";
import { recogniseHighlight, type Highlight } from "../../recognize/highlight.ts";
import type { Editor } from "../editor.ts";
import type { PointerSample, Tool } from "./tool.ts";

export type LineBoxes = (text: TextItem) => Box[];

// Centred on the x-height and tall enough to cover it, unlike the marker preset, which underlines.
const HIGHLIGHT_V = 0.47;
const HIGHLIGHT_WEIGHT = 0.6;

function highlightMark(stroke: StrokeItem, found: Highlight): MarkItem {
  const span = found.to - found.from;
  const points = [-0.01, 0.5, 1.01].map(
    (u, i) => [found.from + u * span, HIGHLIGHT_V - (i === 1 ? 0.02 : 0)] as const,
  );
  return createItem<MarkItem>({
    type: "mark",
    x: 0,
    y: 0,
    color: markColor(stroke.color, "behind"),
    size: stroke.size,
    target: found.target,
    lines: found.lines,
    layer: "behind",
    fit: "stretch",
    strokes: [{ points, weight: HIGHLIGHT_WEIGHT }],
  });
}

function finish(editor: Editor, stroke: StrokeItem, lineBoxes: LineBoxes): void {
  const texts = editor
    .scene()
    .filter((item): item is TextItem => item.type === "text")
    .map((text) => ({ id: text.id, lines: lineBoxes(text) }));
  const found = recogniseHighlight(
    stroke.points.map(([x, y]) => [stroke.x + x, stroke.y + y] as const),
    texts,
  );
  editor.commit([found === null ? stroke : highlightMark(stroke, found)]);
}

export function createMarker(editor: Editor, lineBoxes: LineBoxes): Tool {
  let draft: StrokeItem | null = null;
  const add = (sample: PointerSample): void => {
    if (draft === null) return;
    draft = {
      ...draft,
      points: [...draft.points, [sample.world[0] - draft.x, sample.world[1] - draft.y, 0.5]],
    };
    editor.setDraft([draft]);
  };
  return {
    cursor: "crosshair",
    down(sample) {
      const [x, y] = sample.world;
      const color = markColor(editor.style.color, "behind");
      draft = createItem<StrokeItem>({
        type: "stroke",
        x,
        y,
        color,
        size: editor.style.size,
        points: [],
        pressure: false,
        tip: "marker",
      });
      add(sample);
    },
    move: add,
    up() {
      const stroke = draft;
      draft = null;
      editor.setDraft([]);
      if (stroke !== null) finish(editor, stroke, lineBoxes);
    },
    cancel() {
      draft = null;
      editor.setDraft([]);
    },
  };
}
