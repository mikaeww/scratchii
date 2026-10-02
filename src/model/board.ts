// A board is one canvas: its metadata and its items. Not here: where boards are stored or synced.
import type { Item } from "./item.ts";

export interface Board {
  readonly id: string;
  readonly title: string;
  readonly tags: readonly string[];
  // Milliseconds since the epoch.
  readonly created: number;
  readonly updated: number;
  // Deleted items stay as tombstones so a sync merge cannot bring them back.
  readonly items: readonly Item[];
}

export function createBoard(title: string): Board {
  const now = Date.now();
  return { id: crypto.randomUUID(), title, tags: [], created: now, updated: now, items: [] };
}

export function withItems(board: Board, items: readonly Item[]): Board {
  return { ...board, items, updated: Date.now() };
}

// Replaces items by id and appends new ones; every other item keeps its object identity.
export function putItems(board: Board, changed: readonly Item[]): Board {
  const byId = new Map(changed.map((item) => [item.id, item]));
  const items = board.items.map((item) => {
    const next = byId.get(item.id);
    byId.delete(item.id);
    return next ?? item;
  });
  return withItems(board, [...items, ...byId.values()]);
}

export function visibleItems(board: Board): Item[] {
  return board.items.filter((item) => !item.deleted);
}
