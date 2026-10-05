// Importing a PDF from the interface: notices while pdf.js reads it, when pages were left out, and when the file
// cannot be read. Not here: rendering the pages (src/import/pdf.ts).
import type { Editor } from "../../editor/editor.ts";
import type { Vec } from "../../editor/viewport.ts";
import { MAX_PAGES, importPdf } from "../../import/pdf.ts";
import { chooseFile } from "../../storage/disk.ts";
import { showToast } from "../toast.ts";
import { text } from "../text.ts";

export async function runPdfImport(editor: Editor, file: File, at: Vec): Promise<void> {
  showToast(`${text("pdf.reading")} ${file.name}`, "note");
  try {
    const { placed, total } = await importPdf(editor, file, at);
    if (placed < total) showToast(`${text("pdf.limited")} ${MAX_PAGES} / ${total}`, "note");
  } catch (error) {
    console.error(error);
    showToast(error instanceof Error ? error.message : String(error), "error");
  }
}

export async function pickPdf(editor: Editor, at: () => Vec): Promise<void> {
  const file = await chooseFile(".pdf,application/pdf");
  if (file !== null) await runPdfImport(editor, file, at());
}
