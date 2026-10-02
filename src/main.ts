// Wires the app together: storage, editor, tools, input, canvas and chrome. No logic of its own.
import "./ui/theme.css";
import "./ui/controls.css";
import { Editor } from "./editor/editor.ts";
import { attachInput, type Tools } from "./editor/input.ts";
import { createHand } from "./editor/tools/hand.ts";
import { createPen } from "./editor/tools/pen.ts";
import { createBoard } from "./model/board.ts";
import { readInk } from "./render/ink.ts";
import { keepSaved, openLastBoard } from "./storage/autosave.ts";
import { openBoards } from "./storage/local.ts";
import { mountStage } from "./ui/stage.ts";
import { text } from "./ui/text.ts";
import { showToast } from "./ui/toast.ts";
import { mountChrome } from "./ui/toolbar.ts";

function required<T extends HTMLElement>(selector: string, type: new () => T): T {
  const element = document.querySelector(selector);
  if (!(element instanceof type)) throw new Error(`index.html has no ${selector}`);
  return element;
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
  const tools: Tools = { pen: createPen(editor), hand: createHand(editor) };
  attachInput(canvas, editor, tools);
  mountStage(canvas, editor, readInk(document.documentElement), tools);
  mountChrome(required("#chrome", HTMLDivElement), editor, canvas);
  if (database !== null) {
    keepSaved(database, editor, (error) => {
      console.error(error);
      showToast(text("storage.saveFailed"), "error");
    });
  }
}

await document.fonts.load('16px "Shantell Sans"');
await start();
