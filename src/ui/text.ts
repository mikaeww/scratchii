// Every visible interface string, by key. German joins in phase 9; until then English is the only language.

const ENGLISH = {
  "app.name": "Scratchii",
  "board.untitled": "Untitled board",
  "canvas.label": "Drawing surface",
  "tool.pen": "Pen (P)",
  "tool.hand": "Hand (H, or hold space)",
  "history.undo": "Undo (Ctrl+Z)",
  "history.redo": "Redo (Ctrl+Shift+Z)",
  "zoom.in": "Zoom in",
  "zoom.out": "Zoom out",
  "zoom.reset": "Reset zoom to 100 %",
  "toast.close": "Close",
  "storage.unreadable": "The last board could not be read and was left untouched; a new board was started.",
  "storage.saveFailed": "Saving failed. Your drawing is still here; it will be saved with the next change.",
  "storage.unavailable": "This browser does not allow local storage, so nothing will be saved.",
} as const;

export type TextKey = keyof typeof ENGLISH;

export function text(key: TextKey): string {
  return ENGLISH[key];
}
