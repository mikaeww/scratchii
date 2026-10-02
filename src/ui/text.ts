// Every visible interface string, by key. German joins in phase 9; until then English is the only language.

const ENGLISH = {
  "app.name": "Scratchii",
  "board.untitled": "Untitled board",
  "canvas.label": "Drawing surface",
  "tool.select": "Select (V)",
  "tool.hand": "Hand (H, or hold space)",
  "tool.pen": "Pen (P)",
  "tool.rect": "Box (R)",
  "tool.ellipse": "Ellipse (O)",
  "tool.arrow": "Arrow (A)",
  "tool.line": "Line (L)",
  "tool.text": "Text (T)",
  "tool.note": "Sticky note (N)",
  "tool.eraser": "Eraser (E)",
  "style.label": "Style",
  "style.ink": "Ink",
  "style.fill": "Fill",
  "style.size": "Size",
  "style.none": "No fill",
  "size.s": "Small",
  "size.m": "Medium",
  "size.l": "Large",
  "color.ink": "Black",
  "color.coral": "Coral",
  "color.violet": "Violet",
  "color.teal": "Teal",
  "color.sun": "Yellow",
  "color.pink": "Pink",
  "color.orange": "Orange",
  "color.sky": "Sky blue",
  "color.paper": "White",
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
