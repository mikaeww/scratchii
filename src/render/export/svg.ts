// Writes a scene as a standalone SVG document from the same paint steps the canvas uses.
// Pure: colours, shadow and the embedded font come from the caller.
import type { Box } from "../../geometry/box.ts";
import type { Color } from "../../model/item.ts";
import type { DrawOp } from "../ops.ts";
import type { PaintStep } from "../order.ts";

export interface SvgStyle {
  readonly colors: Readonly<Record<Color, string>>;
  readonly background: string;
  readonly shadow: readonly [number, number];
  // A complete @font-face rule for the handwriting font, or "" to rely on installed fonts.
  readonly fontFace: string;
}

function escape(text: string): string {
  return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

function element(op: DrawOp, style: SvgStyle, shadow: boolean): string {
  switch (op.kind) {
    case "path": {
      const color = (c: Color | null): string =>
        c === null ? "none" : shadow ? style.colors.ink : style.colors[c];
      const stroke =
        op.stroke === null
          ? ""
          : ` stroke="${color(op.stroke)}" stroke-width="${op.width}" stroke-linecap="round" stroke-linejoin="round"`;
      const opacity = op.opacity === 1 ? "" : ` opacity="${op.opacity}"`;
      const shift = shadow ? ` transform="translate(${style.shadow[0]} ${style.shadow[1]})"` : "";
      return `<path d="${op.d}" fill="${color(op.fill)}"${stroke}${opacity}${shift}/>`;
    }
    case "text": {
      const lines = op.lines.map(
        (line, i) => `<tspan x="${op.x}" y="${op.y + i * op.lineHeight}">${escape(line)}</tspan>`,
      );
      return `<text font-family="Shantell Sans" font-weight="500" font-size="${op.fontSize}" dominant-baseline="text-before-edge" text-anchor="${op.align}" fill="${style.colors[op.color]}">${lines.join("")}</text>`;
    }
    case "image":
      return `<image href="${op.src}" width="${op.width}" height="${op.height}"/>`;
  }
}

export function svgDocument(steps: readonly PaintStep[], view: Box, style: SvgStyle): string {
  const body = steps.map((step) => {
    const shadows = step.ops
      .filter((op) => op.kind === "path" && op.shadow)
      .map((op) => element(op, style, true));
    const ops = step.ops.map((op) => element(op, style, false));
    return `<g transform="translate(${step.origin[0]} ${step.origin[1]})">${[...shadows, ...ops].join("")}</g>`;
  });
  const font = style.fontFace === "" ? "" : `<style>${style.fontFace}</style>`;
  const box = `${view.x} ${view.y} ${view.width} ${view.height}`;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box}" width="${view.width}" height="${view.height}">`,
    font,
    `<rect x="${view.x}" y="${view.y}" width="${view.width}" height="${view.height}" fill="${style.background}"/>`,
    ...body,
    "</svg>",
  ].join("\n");
}
