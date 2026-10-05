// Wires the app together: storage, editor, tools, input, canvas and chrome. No logic of its own.
import "./ui/theme/tokens.css";
import "./ui/theme/controls.css";
import "./ui/theme/overlays.css";
import { Editor } from "./editor/editor.ts";
import { attachInput, type Tools } from "./editor/input.ts";
import { createEraser } from "./editor/tools/eraser.ts";
import { createHand } from "./editor/tools/hand.ts";
import { createMarker } from "./editor/tools/marker.ts";
import { createPen } from "./editor/tools/pen.ts";
import { createSelect } from "./editor/tools/select.ts";
import { createShapeTool } from "./editor/tools/shape.ts";
import { createTextTool, editAt, newText, type TextEditing } from "./editor/tools/text.ts";
import { createBoard } from "./model/board.ts";
import { readInk } from "./render/ink.ts";
import { lineBoxes } from "./render/marks.ts";
import { attachDrop } from "./editor/drop.ts";
import { rememberStyle } from "./storage/preferences.ts";
import { openLastBoard } from "./storage/session.ts";
import { openBoards } from "./storage/local.ts";
import { boardPanel } from "./ui/board-panel.ts";
import { boardActions } from "./ui/library/actions.ts";
import { mountContextMenu } from "./ui/menus/context-menu.ts";
import { mountMarkPad } from "./ui/menus/mark-pad.ts";
import { mountOcr } from "./ui/menus/ocr-dialog.ts";
import { mountStage } from "./ui/stage.ts";
import { stylePanel } from "./ui/style-panel.ts";
import { mountTextEditor } from "./ui/text-editor.ts";
import { activeLanguage, text } from "./ui/text.ts";
import { showToast } from "./ui/toast.ts";
import { mountChrome } from "./ui/toolbar.ts";
import { paletteCommands } from "./ui/palette/commands.ts";
import { mountPalette } from "./ui/palette/palette.ts";
import { screenToWorld, type Vec } from "./editor/viewport.ts";

function required<T extends HTMLElement>(selector: string, type: new () => T): T {
  const element = document.querySelector(selector);
  if (!(element instanceof type)) throw new Error(`index.html has no ${selector}`);
  return element;
}

function createTools(editor: Editor, editing: TextEditing): Tools {
  return {
    select: createSelect(editor),
    hand: createHand(editor),
    pen: createPen(editor, () => true),
    marker: createMarker(editor, lineBoxes),
    rect: createShapeTool(editor, "rect"),
    ellipse: createShapeTool(editor, "ellipse"),
    triangle: createShapeTool(editor, "triangle"),
    diamond: createShapeTool(editor, "diamond"),
    star: createShapeTool(editor, "star"),
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
  rememberStyle(editor);
  document.documentElement.lang = activeLanguage();
  const chrome = required("#chrome", HTMLDivElement);
  const editing = mountTextEditor(chrome, editor);
  const tools = createTools(editor, editing);
  attachInput(canvas, editor, tools, (world) => {
    if (editor.tool === "select" && !editAt(editor, editing, world))
      editing.edit(newText(editor, world), true);
  });
  const ink = readInk(document.documentElement);
  const stage = mountStage(canvas, editor, ink, tools);
  mountContextMenu(canvas, editor, ink, { pad: mountMarkPad(editor, ink), toText: mountOcr(editor) });
  const actions = boardActions(editor, ink, database, stage);
  const centre = (): Vec => screenToWorld(editor.view, [canvas.clientWidth / 2, canvas.clientHeight / 2]);
  const openPalette = mountPalette(() => paletteCommands({ editor, centre }));
  mountChrome(chrome, editor, canvas, boardPanel(editor, actions, openPalette));
  chrome.append(stylePanel(editor));
  attachDrop(canvas, editor, {
    onBoardFile: actions.openFile,
    onError: (error) => {
      console.error(error);
      showToast(`${text("image.failed")} ${error instanceof Error ? error.message : String(error)}`, "error");
    },
  });
}

await document.fonts.load('16px "Shantell Sans"');
await start();
