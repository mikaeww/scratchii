// Hand-drawn interface icons as SVG path data on a 24 unit grid, stroked in ink. Not here: canvas drawings.

const PATHS = {
  pen: "M4.5 19.5l1.2-4.6L15.8 4.8a2.2 2.2 0 0 1 3.2 0l.3.3a2.2 2.2 0 0 1 0 3.1L9.2 18.4l-4.7 1.1zM14 6.6l3.4 3.4",
  hand: "M8 12.5V6.2a1.5 1.5 0 0 1 3 0V11m0-5.8V4.6a1.5 1.5 0 0 1 3 0V11m0-5.2a1.5 1.5 0 0 1 3 0V12m0-3.6a1.5 1.5 0 0 1 3 0v5.4c0 4-2.8 6.7-6.6 6.7-2.7 0-4.3-1.2-5.6-3.3L5 14.3a1.5 1.5 0 0 1 2.4-1.8L8 13.3",
  undo: "M9 14.5L4.5 10 9 5.5M4.5 10h9.2a5.8 5.8 0 0 1 0 11.6H10",
  redo: "M15 14.5l4.5-4.5L15 5.5M19.5 10h-9.2a5.8 5.8 0 0 0 0 11.6H14",
  plus: "M12 5v14M5 12h14",
  minus: "M5 12h14",
} as const;

export type IconName = keyof typeof PATHS;

export function icon(name: IconName): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2.25");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", PATHS[name]);
  svg.append(path);
  return svg;
}
