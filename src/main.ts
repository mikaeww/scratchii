// Wires the app together: storage, editor, tools, input, canvas and chrome. No logic of its own.
import "./ui/theme/tokens.css";
import "./ui/theme/controls.css";
import { Editor } from "./editor/editor.ts";
import { attachInput, type Tools } from "./editor/input.ts";
import { createEraser } from "./editor/tools/eraser.ts";
import { createHand } from "./editor/tools/hand.ts";
import { createPen } from "./editor/tools/pen.ts";
import { createSelect } from "./editor/tools/select.ts";
import { createShapeTool } from "./editor/tools/shape.ts";
import { createTextTool, editAt, newText, type TextEditing } from "./editor/tools/text.ts";
import { createBoard } from "./model/board.ts";
import { readInk } from "./render/ink.ts";
import { keepSaved, openLastBoard } from "./storage/autosave.ts";
import { openBoards } from "./storage/local.ts";
import { mountStage } from "./ui/stage.ts";
import { stylePanel } from "./ui/style-panel.ts";
import { mountTextEditor } from "./ui/text-editor.ts";
import { text } from "./ui/text.ts";
import { showToast } from "./ui/toast.ts";
import { mountChrome } from "./ui/toolbar.ts";

function required<T extends HTMLElement>(selector: string, type: new () => T): T {
  const element = document.querySelector(selector);
  if (!(element instanceof type)) throw new Error(`index.html has no ${selector}`);
  return element;
}

function createTools(editor: Editor, editing: TextEditing): Tools {
  return {
    select: createSelect(editor),
    hand: createHand(editor),
    pen: createPen(editor),
    rect: createShapeTool(editor, "rect"),
    ellipse: createShapeTool(editor, "ellipse"),
    line: createShapeTool(editor, "line"),
    arrow: createShapeTool(editor, "arrow"),
    text: createTextTool(editor, "text", editing),
    note: createTextTool(editor, "note", editing),
    eraser: createEraser(editor),
  };
}

async function start(): Promise<void> {
  const canvas = required("#canvas", HTMLCanvasElement);
  canvas.setAttribute("aria-label", text("canvas.label"));
  const database = await openBoards().catch((error: unknown) => {
    console.error(error);
    showToast(text("storage.unavailable"), "error");
    return null;
  });
  const opened = database === null ? null : await openLastBoard(database, text("board.untitled"));
  if (opened?.unreadable) {
    console.error(opened.unreadable);
    showToast(text("storage.unreadable"), "error");
  }
  const editor = new Editor(opened?.board ?? createBoard(text("board.untitled")));
  const chrome = required("#chrome", HTMLDivElement);
  const editing = mountTextEditor(chrome, editor);
  const tools = createTools(editor, editing);
  attachInput(canvas, editor, tools, (world) => {
    if (editor.tool === "select" && !editAt(editor, editing, world))
      editing.edit(newText(editor, world), true);
  });
  mountStage(canvas, editor, readInk(document.documentElement), tools);
  mountChrome(chrome, editor, canvas);
  chrome.append(stylePanel(editor));
  if (database !== null) {
    keepSaved(database, editor, (error) => {
      console.error(error);
      showToast(text("storage.saveFailed"), "error");
    });
  }
}

await document.fonts.load('16px "Shantell Sans"');
await start();
