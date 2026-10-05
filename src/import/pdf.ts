// The pages of a PDF as pictures (ADR 0008): each page rendered with pdf.js, encoded as JPEG and laid out from
// the middle of the view downwards, one picture item per page. pdf.js is loaded on the first import only.
// Not here: where files arrive (src/editor/drop.ts, the palette).
import type { PDFDocumentLoadingTask, PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist";
import type { Editor } from "../editor/editor.ts";
import type { Vec } from "../editor/viewport.ts";
import { createItem, type ImageItem } from "../model/item.ts";

export const MAX_PAGES = 60;
// Longest side of a rendered page in pixels, the width of a placed page and the gap between pages (world units).
const PIXELS = 1600;
const PAGE_WIDTH = 800;
const PAGE_GAP = 40;
const QUALITY = 0.85;

export class PdfImportError extends Error {
  constructor(name: string, cause: unknown) {
    super(`${name} could not be read as a PDF${cause instanceof Error ? `: ${cause.message}` : ""}`, {
      cause,
    });
    this.name = "PdfImportError";
  }
}

async function renderPage(page: PDFPageProxy): Promise<{ src: string; aspect: number }> {
  const natural = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale: PIXELS / Math.max(natural.width, natural.height) });
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);
  // JPEG has no transparency; pages without a background would turn black.
  const context = canvas.getContext("2d");
  if (context !== null) {
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
  }
  await page.render({ canvas, viewport }).promise;
  return { src: canvas.toDataURL("image/jpeg", QUALITY), aspect: natural.height / natural.width };
}

export interface PdfResult {
  readonly placed: number;
  readonly total: number;
}

export async function importPdf(editor: Editor, file: File, at: Vec): Promise<PdfResult> {
  let pdf: PDFDocumentProxy;
  let task: PDFDocumentLoadingTask;
  try {
    const pdfjs = await import("pdfjs-dist");
    const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
    task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
    pdf = await task.promise;
  } catch (error) {
    throw new PdfImportError(file.name || "The file", error);
  }
  try {
    const count = Math.min(MAX_PAGES, pdf.numPages);
    const items: ImageItem[] = [];
    let y = at[1];
    for (let n = 1; n <= count; n++) {
      const { src, aspect } = await renderPage(await pdf.getPage(n));
      const height = PAGE_WIDTH * aspect;
      items.push(
        createItem<ImageItem>({
          type: "image",
          x: at[0] - PAGE_WIDTH / 2,
          y,
          color: "ink",
          size: "m",
          width: PAGE_WIDTH,
          height,
          src,
        }),
      );
      y += height + PAGE_GAP;
    }
    editor.commit(items);
    editor.setSelection(items.map((item) => item.id));
    return { placed: count, total: pdf.numPages };
  } catch (error) {
    throw new PdfImportError(file.name || "The file", error);
  } finally {
    // Ends the worker's copy of the document; the pages are pictures on the board by now.
    await task.destroy();
  }
}
