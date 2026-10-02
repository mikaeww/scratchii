// Board summaries for the library, search over them, and the id rule for imports. Pure; storage is elsewhere.
import type { Board } from "../model/board.ts";

export interface Summary {
  readonly id: string;
  readonly title: string;
  readonly tags: readonly string[];
  readonly updated: number;
  // Lower-cased title, tags and live text, for search.
  readonly haystack: string;
}

export function summarise(board: Board): Summary {
  const texts = board.items.flatMap((item) =>
    !item.deleted && (item.type === "text" || item.type === "note") ? [item.text] : [],
  );
  return {
    id: board.id,
    title: board.title,
    tags: board.tags,
    updated: board.updated,
    haystack: [board.title, ...board.tags, ...texts].join("\n").toLowerCase(),
  };
}

export function search(summaries: readonly Summary[], query: string): Summary[] {
  const needle = query.trim().toLowerCase();
  const found =
    needle === "" ? [...summaries] : summaries.filter((summary) => summary.haystack.includes(needle));
  return found.sort((a, b) => b.updated - a.updated);
}

// An imported board never replaces a stored one: if its id is taken it becomes a copy with a new id.
export function importAs(board: Board, taken: ReadonlySet<string>): Board {
  return taken.has(board.id) ? { ...board, id: crypto.randomUUID() } : board;
}

// Tags typed as "plans, Work ,ideas" become ["plans", "Work", "ideas"]; empty and repeated ones are dropped.
export function parseTags(text: string): string[] {
  return [
    ...new Set(
      text
        .split(",")
        .map((tag) => tag.trim())
        .filter((tag) => tag !== ""),
    ),
  ];
}
