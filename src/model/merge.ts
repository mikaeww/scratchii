// Merges two copies of one board, e.g. local and server. Per item the newer version wins, so concurrent
// edits to different items both survive. Rules and their proofs: docs/verification/sync.md.
import type { Board } from "./board.ts";
import type { Item } from "./item.ts";

// A total order, so the result never depends on argument order. Equal version and nonce should mean the same
// edit; if two edits ever collide on both (1 in 2^31), the tombstone wins, then the smaller JSON text.
export function newerItem(a: Item, b: Item): Item {
  if (a.version !== b.version) return a.version > b.version ? a : b;
  if (a.nonce !== b.nonce) return b.nonce < a.nonce ? b : a;
  if (a.deleted !== b.deleted) return a.deleted ? a : b;
  return JSON.stringify(b) < JSON.stringify(a) ? b : a;
}

export function mergeItems(first: readonly Item[], second: readonly Item[]): Item[] {
  const others = new Map(second.map((item) => [item.id, item]));
  const merged = first.map((item) => {
    const other = others.get(item.id);
    others.delete(item.id);
    return other === undefined ? item : newerItem(item, other);
  });
  return [...merged, ...others.values()];
}

function newerMeta(a: Board, b: Board): Board {
  if (a.metaUpdated !== b.metaUpdated) return a.metaUpdated > b.metaUpdated ? a : b;
  if (a.title !== b.title) return b.title < a.title ? b : a;
  return JSON.stringify(b.tags) < JSON.stringify(a.tags) ? b : a;
}

export class MergeError extends Error {
  constructor(a: string, b: string) {
    super(`cannot merge different boards ${a} and ${b}`);
    this.name = "MergeError";
  }
}

export function mergeBoards(first: Board, second: Board): Board {
  if (first.id !== second.id) throw new MergeError(first.id, second.id);
  const meta = newerMeta(first, second);
  return {
    id: first.id,
    title: meta.title,
    tags: meta.tags,
    created: Math.min(first.created, second.created),
    updated: Math.max(first.updated, second.updated),
    metaUpdated: meta.metaUpdated,
    items: mergeItems(first.items, second.items),
  };
}
