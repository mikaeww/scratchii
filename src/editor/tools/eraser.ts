// The eraser: everything the pointer passes over while pressed is removed when it lifts.
import { itemAt } from "../../geometry/hit.ts";
import { updateItem, type Item } from "../../model/item.ts";
import type { Editor } from "../editor.ts";
import type { PointerSample, Tool } from "./tool.ts";

// Screen pixels around the pointer that count as touching.
const REACH = 8;

export function createEraser(editor: Editor): Tool {
  let erased = new Map<string, Item>();
  let active = false;
  const rub = (sample: PointerSample): void => {
    if (!active) return;
    const hit = itemAt(editor.scene(), sample.world, REACH / editor.view.zoom);
    if (hit === null || erased.has(hit.id)) return;
    erased.set(hit.id, hit);
    editor.setDraft([...erased.values()].map((item) => ({ ...item, deleted: true })));
  };
  const reset = (): void => {
    active = false;
    erased = new Map();
    editor.setDraft([]);
  };
  return {
    cursor: "cell",
    down(sample) {
      active = true;
      rub(sample);
    },
    move: rub,
    up() {
      const gone = [...erased.values()].map((item) => updateItem(item, { deleted: true }));
      reset();
      editor.commit(gone);
    },
    cancel: reset,
  };
}
