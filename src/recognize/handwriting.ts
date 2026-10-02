// Handwriting to text (experimental): pen strokes become a black-on-white picture that Tesseract reads.
// Tesseract and its English and German models are loaded from /ocr only on first use, never from the net.
import type { Worker } from "tesseract.js";
import { strokePath } from "../geometry/freehand.ts";
import { unite, type Box } from "../geometry/box.ts";
import { boundsOf } from "../geometry/bounds.ts";
import type { StrokeItem } from "../model/item.ts";

// Tesseract reads best with letters a few dozen pixels tall and a quiet border around them.
const TARGET_HEIGHT = 96;
const PADDING = 24;
const MAX_SIDE = 4000;

export interface Reading {
  readonly text: string;
  // Tesseract's own mean confidence, 0 to 100.
  readonly confidence: number;
}

let worker: Promise<Worker> | null = null;

async function startWorker(): Promise<Worker> {
  const { createWorker, OEM } = await import("tesseract.js");
  return createWorker(["eng", "deu"], OEM.LSTM_ONLY, {
    workerPath: "/ocr/worker.min.js",
    corePath: "/ocr",
    langPath: "/ocr",
    gzip: true,
    // The models come from our own files, so there is nothing worth caching in IndexedDB.
    cacheMethod: "none",
    workerBlobURL: false,
  });
}

export function strokesBox(strokes: readonly StrokeItem[]): Box | null {
  return unite(strokes.map(boundsOf));
}

export function strokesImage(strokes: readonly StrokeItem[]): HTMLCanvasElement | null {
  const box = strokesBox(strokes);
  if (box === null || box.height === 0) return null;
  const scale = Math.min(
    3,
    Math.max(1, TARGET_HEIGHT / box.height),
    MAX_SIDE / box.width,
    MAX_SIDE / box.height,
  );
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(box.width * scale + 2 * PADDING);
  canvas.height = Math.ceil(box.height * scale + 2 * PADDING);
  const context = canvas.getContext("2d");
  if (context === null) return null;
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#000000";
  for (const stroke of strokes) {
    context.setTransform(
      scale,
      0,
      0,
      scale,
      PADDING + (stroke.x - box.x) * scale,
      PADDING + (stroke.y - box.y) * scale,
    );
    context.fill(new Path2D(strokePath(stroke.points, stroke.size, stroke.pressure)));
  }
  return canvas;
}

export async function readHandwriting(image: HTMLCanvasElement): Promise<Reading> {
  // A failed start is forgotten, so the next attempt tries again instead of failing forever.
  worker ??= startWorker().catch((error: unknown) => {
    worker = null;
    throw error;
  });
  const result = await (await worker).recognize(image);
  return { text: result.data.text.trim(), confidence: result.data.confidence };
}
