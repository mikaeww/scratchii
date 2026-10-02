// Pictures and board files that arrive by drag and drop or paste.
import { createItem, type ImageItem } from "../model/item.ts";
import type { Editor } from "./editor.ts";
import { screenToWorld, type Vec } from "./viewport.ts";

// Longest side kept for pictures; larger ones are scaled down so boards stay light enough to sync.
const MAX_SIDE = 2048;
// Pictures land at most this wide on the canvas (world units), whatever their pixel size.
const PLACED_WIDTH = 480;
const SPREAD = 24;

export class ImageImportError extends Error {
  constructor(name: string, cause: unknown) {
    super(`${name} could not be read as a picture`, { cause });
    this.name = "ImageImportError";
  }
}

async function dataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("read did not produce a data URL"));
    });
    reader.addEventListener("error", () => {
      reject(reader.error ?? new Error("read failed"));
    });
    reader.readAsDataURL(file);
  });
}

async function encode(file: File): Promise<{ src: string; width: number; height: number }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  if (scale === 1 && /^image\/(png|jpeg|webp)$/.test(file.type)) {
    bitmap.close();
    return { src: await dataUrl(file), width, height };
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const type = file.type === "image/jpeg" ? "image/jpeg" : "image/png";
  return { src: canvas.toDataURL(type, 0.9), width, height };
}

export async function placeImages(editor: Editor, files: readonly File[], at: Vec): Promise<void> {
  const items: ImageItem[] = [];
  for (const [index, file] of files.entries()) {
    try {
      const { src, width, height } = await encode(file);
      const shown = Math.min(1, PLACED_WIDTH / width);
      const [x, y] = [
        at[0] + index * SPREAD - (width * shown) / 2,
        at[1] + index * SPREAD - (height * shown) / 2,
      ];
      items.push(
        createItem<ImageItem>({
          type: "image",
          x,
          y,
          color: "ink",
          size: "m",
          width: width * shown,
          height: height * shown,
          src,
        }),
      );
    } catch (error) {
      throw new ImageImportError(file.name || "A picture", error);
    }
  }
  editor.commit(items);
  editor.setSelection(items.map((item) => item.id));
}

export interface Arrivals {
  readonly onBoardFile: (file: File) => void;
  readonly onError: (error: unknown) => void;
}

function sort(files: readonly File[], arrivals: Arrivals): File[] {
  const pictures = files.filter((file) => file.type.startsWith("image/"));
  for (const file of files) if (file.name.endsWith(".scratchii")) arrivals.onBoardFile(file);
  return pictures;
}

export function attachDrop(canvas: HTMLCanvasElement, editor: Editor, arrivals: Arrivals): void {
  canvas.addEventListener("dragover", (event) => {
    event.preventDefault();
  });
  canvas.addEventListener("drop", (event) => {
    event.preventDefault();
    const box = canvas.getBoundingClientRect();
    const at = screenToWorld(editor.view, [event.clientX - box.left, event.clientY - box.top]);
    const pictures = sort([...(event.dataTransfer?.files ?? [])], arrivals);
    if (pictures.length > 0) placeImages(editor, pictures, at).catch(arrivals.onError);
  });
  document.addEventListener("paste", (event) => {
    const pictures = [...(event.clipboardData?.files ?? [])].filter((file) => file.type.startsWith("image/"));
    if (pictures.length === 0) return;
    event.preventDefault();
    const centre = screenToWorld(editor.view, [canvas.clientWidth / 2, canvas.clientHeight / 2]);
    placeImages(editor, pictures, centre).catch(arrivals.onError);
  });
}
