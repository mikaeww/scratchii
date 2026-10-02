// The .scratchii file: a versioned JSON wrapper around one board. Not here: reading or writing disks.
import type { Board } from "./board.ts";
import { ValidationError, validateBoard } from "./validate.ts";

export const FILE_FORMAT = "scratchii";
export const FILE_VERSION = 1;
export const FILE_EXTENSION = ".scratchii";

export function serialiseFile(board: Board): string {
  return JSON.stringify({ format: FILE_FORMAT, version: FILE_VERSION, board });
}

export function parseFile(text: string, name = "file"): Board {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (error) {
    throw new ValidationError(name, `not JSON (${error instanceof Error ? error.message : String(error)})`);
  }
  const file = value as { format?: unknown; version?: unknown; board?: unknown } | null;
  if (typeof file !== "object" || file === null || file.format !== FILE_FORMAT) {
    throw new ValidationError(`${name}.format`, "not a Scratchii board");
  }
  if (file.version !== FILE_VERSION) {
    throw new ValidationError(
      `${name}.version`,
      `version ${String(file.version)} is not supported (expected ${FILE_VERSION})`,
    );
  }
  const extra = Object.keys(file).find((key) => !["format", "version", "board"].includes(key));
  if (extra !== undefined) throw new ValidationError(`${name}.${extra}`, "unknown field");
  return validateBoard(file.board, `${name}.board`);
}
