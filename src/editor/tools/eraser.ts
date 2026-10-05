// The eraser: everything the pointer passes over while pressed is removed when it lifts.
import { itemAt } from "../../geometry/hit.ts";
import { updateItem, type Item } from "../../model/item.ts";
import type { Editor } from "../editor.ts";
import type { Vec } from "../viewport.ts";
import type { PointerSample, Tool } from "./tool.ts";

// Screen pixels around the pointer that count as touching.
const REACH = 8;

export function createEraser(editor: Editor): Tool {
  let erased = new Map<string, Item>();
  let active = false;
  let last: Vec = [0, 0];
  const rubAt = (world: Vec): boolean => {
    const hit = itemAt(editor.scene(), world, REACH / editor.view.zoom);
    if (hit === null || erased.has(hit.id)) return false;
    erased.set(hit.id, hit);
    return true;
  };
  // A fast swipe leaves gaps between samples wider than the eraser; the path in between is rubbed too.
  const rub = (sample: PointerSample): void => {
    if (!active) return;
    const [x, y] = sample.world;
    const reach = REACH / editor.view.zoom;
    const steps = Math.max(1, Math.ceil(Math.hypot(x - last[0], y - last[1]) / reach));
    let changed = false;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      changed = rubAt([last[0] + (x - last[0]) * t, last[1] + (y - last[1]) * t]) || changed;
    }
    last = sample.world;
    if (changed) editor.setDraft([...erased.values()].map((item) => ({ ...item, deleted: true })));
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
      last = sample.world;
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
