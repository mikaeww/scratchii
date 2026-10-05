// The editing session of one board: items, viewport, tool and style, selection, the draft being drawn, undo.
// Not here: input handling (input.ts, tools/), drawing (src/render) or storage (src/storage).
import type { Box } from "../geometry/box.ts";
import { mergeBoards } from "../model/merge.ts";
import { nextUpdate, putItems, withItems, type Board } from "../model/board.ts";
import { updateItem, type Color, type Item, type Size } from "../model/item.ts";
import { History } from "./history.ts";
import type { Viewport } from "./viewport.ts";

export type ToolName =
  | "select"
  | "hand"
  | "pen"
  | "marker"
  | "rect"
  | "ellipse"
  | "triangle"
  | "diamond"
  | "star"
  | "line"
  | "arrow"
  | "text"
  | "note"
  | "eraser";
export type Change =
  "board" | "meta" | "items" | "remote" | "view" | "tool" | "style" | "draft" | "selection";

export interface Style {
  readonly color: Color;
  readonly fill: Color | null;
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
  style: Style = { color: "ink", fill: "paper", size: "m" };
  // Work in progress: replaces stored items with the same id, or adds new ones, until committed.
  draft: readonly Item[] = [];
  selection: ReadonlySet<string> = new Set();
  marquee: Box | null = null;
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
    this.view = { x: 0, y: 0, zoom: 1 };
    this.draft = [];
    this.selection = new Set();
    this.history.reset(board.items);
    this.emit("board");
  }

  // Marks on a text that is deleted here are deleted in the same step, so one undo brings both back.
  commit(changed: readonly Item[]): void {
    if (changed.length === 0) return;
    const gone = new Set(changed.filter((item) => item.deleted).map((item) => item.id));
    const listed = new Set(changed.map((item) => item.id));
    const orphans = this.board.items.filter(
      (item) => item.type === "mark" && !item.deleted && gone.has(item.target) && !listed.has(item.id),
    );
    this.board = putItems(this.board, [
      ...changed,
      ...orphans.map((item) => updateItem(item, { deleted: true })),
    ]);
    this.history.commit(this.board.items);
    this.emit("items");
  }

  // Replaces the whole item list, e.g. after reordering.
  commitOrder(items: readonly Item[]): void {
    this.board = withItems(this.board, items);
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

  // Title and tags; they are part of the board, not of any item.
  updateBoard(meta: Partial<Pick<Board, "title" | "tags">>): void {
    const now = nextUpdate(this.board);
    this.board = { ...this.board, ...meta, updated: now, metaUpdated: now };
    this.emit("meta");
  }

  // Folds a copy from the sync server into the open board without an undo step; the merge keeps every newer
  // local edit, and `updated` does not move, so the result is not pushed straight back.
  applyRemote(remote: Board): void {
    this.board = mergeBoards(this.board, remote);
    this.emit("remote");
  }

  setView(view: Viewport): void {
    this.view = view;
    this.emit("view");
  }

  setTool(tool: ToolName): void {
    this.tool = tool;
    if (tool !== "select") this.setSelection([]);
    this.emit("tool");
  }

  setStyle(style: Partial<Style>): void {
    this.style = { ...this.style, ...style };
    this.emit("style");
  }

  setDraft(draft: readonly Item[]): void {
    this.draft = draft;
    this.emit("draft");
  }

  setSelection(ids: Iterable<string>): void {
    this.selection = new Set(ids);
    this.emit("selection");
  }

  setMarquee(box: Box | null): void {
    this.marquee = box;
    this.emit("draft");
  }

  selected(): Item[] {
    return this.board.items.filter((item) => !item.deleted && this.selection.has(item.id));
  }

  // What the renderer draws, bottom to top: stored items with the draft applied, then new draft items.
  scene(): Item[] {
    const drafts = new Map(this.draft.map((item) => [item.id, item]));
    const items = this.board.items.map((item) => {
      const draft = drafts.get(item.id);
      drafts.delete(item.id);
      return draft ?? item;
    });
    return [...items, ...drafts.values()].filter((item) => !item.deleted);
  }
}
