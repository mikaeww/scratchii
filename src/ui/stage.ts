// Keeps the canvas sized to its box at device resolution and redraws once per frame, only after a change.
import type { Editor } from "../editor/editor.ts";
import type { Tools } from "../editor/input.ts";
import { drawScene } from "../render/canvas.ts";
import type { Ink } from "../render/ink.ts";

export class CanvasUnavailableError extends Error {
  constructor() {
    super("This browser cannot draw on a 2D canvas.");
    this.name = "CanvasUnavailableError";
  }
}

export function mountStage(canvas: HTMLCanvasElement, editor: Editor, ink: Ink, tools: Tools): void {
  const context = canvas.getContext("2d", { alpha: false, desynchronized: true });
  if (context === null) throw new CanvasUnavailableError();
  let pending = false;
  const draw = (): void => {
    pending = false;
    const scene = {
      items: editor.scene(),
      view: editor.view,
      width: canvas.clientWidth,
      height: canvas.clientHeight,
      ratio: window.devicePixelRatio,
    };
    drawScene(context, scene, ink);
  };
  const request = (): void => {
    if (pending) return;
    pending = true;
    requestAnimationFrame(draw);
  };
  const resize = (): void => {
    canvas.width = Math.round(canvas.clientWidth * window.devicePixelRatio);
    canvas.height = Math.round(canvas.clientHeight * window.devicePixelRatio);
    request();
  };
  // Moving the window to a screen with another scale changes the ratio without resizing the box.
  const watchRatio = (): void => {
    matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`).addEventListener(
      "change",
      () => {
        resize();
        watchRatio();
      },
      { once: true },
    );
  };
  new ResizeObserver(resize).observe(canvas);
  watchRatio();
  editor.on((change) => {
    if (change === "tool" || change === "style") canvas.style.cursor = tools[editor.tool].cursor;
    else request();
  });
  canvas.style.cursor = tools[editor.tool].cursor;
  resize();
}
