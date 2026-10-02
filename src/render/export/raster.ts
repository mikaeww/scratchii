// Renders a board to a canvas for PNG, PDF and library thumbnails, and wraps the SVG export with its font.
import { boundsOf } from "../../geometry/bounds.ts";
import { grow, unite, type Box } from "../../geometry/box.ts";
import type { Item } from "../../model/item.ts";
import { drawScene } from "../canvas.ts";
import { decodeAll } from "../images.ts";
import type { Ink } from "../ink.ts";
import { paintOrder } from "../order.ts";
import { pdfFromJpeg } from "./pdf.ts";
import { svgDocument } from "./svg.ts";

const PADDING = 32;
// Browsers refuse canvases much larger than this per side.
const MAX_SIDE = 8192;
const EMPTY: Box = { x: 0, y: 0, width: 400, height: 300 };

export class ExportError extends Error {
  constructor(what: string) {
    super(`Export failed: ${what}`);
    this.name = "ExportError";
  }
}

export function contentBox(items: readonly Item[]): Box {
  const placed = items.filter((item) => !item.deleted && item.type !== "mark");
  return grow(unite(placed.map(boundsOf)) ?? EMPTY, PADDING);
}

export async function renderBoard(
  items: readonly Item[],
  ink: Ink,
  scale: number,
  frame = contentBox(items),
): Promise<HTMLCanvasElement> {
  await decodeAll(items.flatMap((item) => (item.type === "image" && !item.deleted ? [item.src] : [])));
  const fit = Math.min(scale, MAX_SIDE / frame.width, MAX_SIDE / frame.height);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(frame.width * fit));
  canvas.height = Math.max(1, Math.round(frame.height * fit));
  const context = canvas.getContext("2d");
  if (context === null) throw new ExportError("no 2D canvas");
  const view = { x: frame.x, y: frame.y, zoom: 1 };
  drawScene(context, { items, view, width: frame.width, height: frame.height, ratio: fit }, ink);
  return canvas;
}

async function blobOf(canvas: HTMLCanvasElement, type: string): Promise<Blob> {
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, type, 0.92);
  });
  if (blob === null) throw new ExportError(`the browser could not encode ${type}`);
  return blob;
}

export async function exportPng(items: readonly Item[], ink: Ink): Promise<Blob> {
  return blobOf(await renderBoard(items, ink, 2), "image/png");
}

export async function exportPdf(items: readonly Item[], ink: Ink): Promise<Blob> {
  const canvas = await renderBoard(items, ink, 2);
  const jpeg = new Uint8Array(await (await blobOf(canvas, "image/jpeg")).arrayBuffer());
  const box = contentBox(items);
  const page = pdfFromJpeg(jpeg, canvas, box);
  return new Blob([page], { type: "application/pdf" });
}

async function fontFace(): Promise<string> {
  const response = await fetch("/fonts/shantell-sans.woff2");
  if (!response.ok) throw new ExportError(`font download answered ${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return `@font-face{font-family:"Shantell Sans";src:url(data:font/woff2;base64,${btoa(binary)}) format("woff2");font-weight:300 800;}`;
}

export async function exportSvg(items: readonly Item[], ink: Ink): Promise<Blob> {
  const svg = svgDocument(paintOrder(items), contentBox(items), {
    colors: ink.colors,
    background: ink.canvas,
    shadow: ink.shadow,
    fontFace: await fontFace(),
  });
  return new Blob([svg], { type: "image/svg+xml" });
}

export async function thumbnail(items: readonly Item[], ink: Ink): Promise<string> {
  const box = contentBox(items);
  const canvas = await renderBoard(items, ink, Math.min(1, 320 / box.width, 200 / box.height));
  return canvas.toDataURL("image/png");
}
