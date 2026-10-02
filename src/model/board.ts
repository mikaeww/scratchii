// A board is one canvas: its metadata and its items. Not here: where boards are stored or synced.
import type { Item } from "./item.ts";

export interface Board {
  readonly id: string;
  readonly title: string;
  readonly tags: readonly string[];
  // Milliseconds since the epoch.
  readonly created: number;
  readonly updated: number;
  // When title or tags last changed; sync merges them on this, not on `updated`, which every stroke bumps.
  readonly metaUpdated: number;
  // Deleted items stay as tombstones so a sync merge cannot bring them back.
  readonly items: readonly Item[];
}

export function createBoard(title: string): Board {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    title,
    tags: [],
    created: now,
    updated: now,
    metaUpdated: now,
    items: [],
  };
}

// Never earlier than the last change, even if this device's clock is behind the one that made it; sync
// pushes a board when `updated` grew, so a step back would hide local edits.
export function nextUpdate(board: Board): number {
  return Math.max(Date.now(), board.updated + 1);
}

export function withItems(board: Board, items: readonly Item[]): Board {
  return { ...board, items, updated: nextUpdate(board) };
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
