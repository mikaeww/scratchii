// The hand: drags the viewport. Also used while space or the middle mouse button is held.
import type { Editor } from "../editor.ts";
import { panBy, type Vec } from "../viewport.ts";
import type { Tool } from "./tool.ts";

export function createHand(editor: Editor): Tool {
  let last: Vec | null = null;
  return {
    cursor: "grab",
    down(sample) {
      last = sample.screen;
    },
    move(sample) {
      if (last === null) return;
      editor.setView(panBy(editor.view, sample.screen[0] - last[0], sample.screen[1] - last[1]));
      last = sample.screen;
    },
    up() {
      last = null;
    },
    cancel() {
      last = null;
    },
  };
}
