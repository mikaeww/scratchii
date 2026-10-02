// The editing session of one board: items, viewport, active tool and style, the draft being drawn, and undo.
// Not here: input handling (input.ts, tools/), drawing (src/render) or storage (src/storage).
import { putItems, visibleItems, withItems, type Board } from "../model/board.ts";
import { updateItem, type Color, type Item, type Size } from "../model/item.ts";
import { History } from "./history.ts";
import type { Viewport } from "./viewport.ts";

export type ToolName = "pen" | "hand";
export type Change = "board" | "items" | "view" | "tool" | "style" | "draft";

export interface Style {
  readonly color: Color;
  readonly size: Size;
}

type Listener = (change: Change) => void;

// Undo must not hand old versions to sync, or the merge would discard them: every item that differs from the
// target snapshot comes back as a new version of the target, and items the target does not know are tombstoned.
function restore(current: readonly Item[], target: readonly Item[]): Item[] {
  const now = new Map(current.map((item) => [item.id, item]));
  const restored = target.map((item) => {
    const present = now.get(item.id);
    now.delete(item.id);
    if (present === undefined || present === item) return item;
    return { ...updateItem(item, {}), version: Math.max(item.version, present.version) + 1 };
  });
  const gone = [...now.values()].map((item) => (item.deleted ? item : updateItem(item, { deleted: true })));
  return [...restored, ...gone];
}

export class Editor {
  board: Board;
  view: Viewport = { x: 0, y: 0, zoom: 1 };
  tool: ToolName = "pen";
  style: Style = { color: "ink", size: "m" };
  draft: Item | null = null;
  private readonly history: History<readonly Item[]>;
  private readonly listeners = new Set<Listener>();

  constructor(board: Board) {
    this.board = board;
    this.history = new History(board.items);
  }

  on(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(change: Change): void {
    for (const listener of this.listeners) listener(change);
  }

  load(board: Board): void {
    this.board = board;
    this.draft = null;
    this.history.reset(board.items);
    this.emit("board");
  }

  commit(changed: readonly Item[]): void {
    if (changed.length === 0) return;
    this.board = putItems(this.board, changed);
    this.history.commit(this.board.items);
    this.emit("items");
  }

  get canUndo(): boolean {
    return this.history.canUndo;
  }

  get canRedo(): boolean {
    return this.history.canRedo;
  }

  undo(): void {
    if (!this.canUndo) return;
    this.board = withItems(this.board, restore(this.board.items, this.history.undo()));
    this.emit("items");
  }

  redo(): void {
    if (!this.canRedo) return;
    this.board = withItems(this.board, restore(this.board.items, this.history.redo()));
    this.emit("items");
  }

  setView(view: Viewport): void {
    this.view = view;
    this.emit("view");
  }

  setTool(tool: ToolName): void {
    this.tool = tool;
    this.emit("tool");
  }

  setStyle(style: Partial<Style>): void {
    this.style = { ...this.style, ...style };
    this.emit("style");
  }

  setDraft(draft: Item | null): void {
    this.draft = draft;
    this.emit("draft");
  }

  // What the renderer draws: live items, then the draft on top.
  scene(): Item[] {
    const items = visibleItems(this.board);
    return this.draft === null ? items : [...items, this.draft];
  }
}
