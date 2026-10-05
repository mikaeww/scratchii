// Translates DOM pointer, wheel and keyboard events on the canvas into tool calls and editor commands.
// Not here: what a tool does with a sample.
import type { Editor, ToolName } from "./editor.ts";
import { attachClipboard, handleShortcut } from "./shortcuts.ts";
import type { PointerSample, Tool } from "./tools/tool.ts";
import { panBy, screenToWorld, zoomAt, type Vec } from "./viewport.ts";

export type Tools = Readonly<Record<ToolName, Tool>>;

const LINE_HEIGHT = 16;

function sampleOf(canvas: HTMLCanvasElement, editor: Editor, event: PointerEvent): PointerSample {
  const box = canvas.getBoundingClientRect();
  const screen: Vec = [event.clientX - box.left, event.clientY - box.top];
  return {
    screen,
    world: screenToWorld(editor.view, screen),
    pressure: event.pressure,
    hasPressure: event.pointerType === "pen",
    shift: event.shiftKey,
  };
}

export function isTyping(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))
  );
}

function attachPointer(
  canvas: HTMLCanvasElement,
  editor: Editor,
  tools: Tools,
  spaceHeld: () => boolean,
): void {
  let active: { tool: Tool; id: number } | null = null;
  canvas.addEventListener("pointerdown", (event) => {
    if (active !== null || (event.button !== 0 && event.button !== 1)) return;
    const tool = event.button === 1 || spaceHeld() ? tools.hand : tools[editor.tool];
    active = { tool, id: event.pointerId };
    canvas.setPointerCapture(event.pointerId);
    tool.down(sampleOf(canvas, editor, event));
  });
  canvas.addEventListener("pointermove", (event) => {
    if (active?.id !== event.pointerId) return;
    // Coalesced events carry every sample since the last frame; without them fast strokes turn into polygons.
    for (const sample of event.getCoalescedEvents()) active.tool.move(sampleOf(canvas, editor, sample));
  });
  const finish = (event: PointerEvent): void => {
    if (active?.id !== event.pointerId) return;
    const { tool } = active;
    active = null;
    if (event.type === "pointercancel") tool.cancel();
    else tool.up(sampleOf(canvas, editor, event));
  };
  canvas.addEventListener("pointerup", finish);
  canvas.addEventListener("pointercancel", finish);
}

function attachWheel(canvas: HTMLCanvasElement, editor: Editor): void {
  canvas.addEventListener(
    "wheel",
    (event) => {
      event.preventDefault();
      const scale = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? LINE_HEIGHT : 1;
      const box = canvas.getBoundingClientRect();
      const anchor: Vec = [event.clientX - box.left, event.clientY - box.top];
      // Touchpad pinch arrives as a wheel event with ctrlKey set.
      if (event.ctrlKey || event.metaKey) {
        editor.setView(zoomAt(editor.view, anchor, Math.exp((-event.deltaY * scale) / 200)));
      } else {
        editor.setView(panBy(editor.view, -event.deltaX * scale, -event.deltaY * scale));
      }
    },
    { passive: false },
  );
}

export function attachInput(
  canvas: HTMLCanvasElement,
  editor: Editor,
  tools: Tools,
  onDoubleClick: (world: Vec) => void,
): void {
  let space = false;
  attachPointer(canvas, editor, tools, () => space);
  attachWheel(canvas, editor);
  attachClipboard(editor, isTyping);
  canvas.addEventListener("dblclick", (event) => {
    const box = canvas.getBoundingClientRect();
    onDoubleClick(screenToWorld(editor.view, [event.clientX - box.left, event.clientY - box.top]));
  });
  window.addEventListener("keydown", (event) => {
    if (isTyping(event.target)) return;
    if (event.key === " ") {
      space = true;
      canvas.style.cursor = tools.hand.cursor;
      event.preventDefault();
    } else if (handleShortcut(event, editor)) {
      event.preventDefault();
    }
  });
  window.addEventListener("keyup", (event) => {
    if (event.key !== " ") return;
    space = false;
    canvas.style.cursor = tools[editor.tool].cursor;
  });
}
