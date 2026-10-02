// The pen: one pointer stroke becomes one stroke item, shown as a draft until the pointer lifts.
import { createItem, type StrokeItem, type StrokePoint } from "../../model/item.ts";
import type { Editor } from "../editor.ts";
import type { PointerSample, Tool } from "./tool.ts";

function relative(draft: StrokeItem, sample: PointerSample): StrokePoint {
  return [sample.world[0] - draft.x, sample.world[1] - draft.y, sample.hasPressure ? sample.pressure : 0.5];
}

export function createPen(editor: Editor): Tool {
  let draft: StrokeItem | null = null;
  return {
    cursor: "crosshair",
    down(sample) {
      draft = createItem<StrokeItem>({
        type: "stroke",
        x: sample.world[0],
        y: sample.world[1],
        color: editor.style.color,
        size: editor.style.size,
        points: [],
        pressure: sample.hasPressure,
      });
      draft = { ...draft, points: [relative(draft, sample)] };
      editor.setDraft([draft]);
    },
    move(sample) {
      if (draft === null) return;
      draft = { ...draft, points: [...draft.points, relative(draft, sample)] };
      editor.setDraft([draft]);
    },
    up() {
      if (draft === null) return;
      const finished = draft;
      draft = null;
      editor.setDraft([]);
      editor.commit([finished]);
    },
    cancel() {
      draft = null;
      editor.setDraft([]);
    },
  };
}
