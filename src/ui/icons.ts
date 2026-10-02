// Hand-drawn interface icons as SVG path data on a 24 unit grid, stroked in ink. Not here: canvas drawings.

const PATHS = {
  select: "M5.5 3.5l13 7.2-5.8 1.6 3.4 6.2-2.6 1.4-3.4-6.2-4.2 4.1z",
  rect: "M4.5 6.5c5-.6 10-.5 15 0 .5 3.7.4 7.4 0 11-5 .6-10 .5-15 0-.4-3.6-.4-7.3 0-11z",
  ellipse: "M12 5.5c4.6 0 8 2.9 8 6.5s-3.4 6.5-8 6.5-8-2.9-8-6.5 3.4-6.5 8-6.5z",
  line: "M5 19L19 5",
  arrow: "M5 19L19 5M10.5 5H19v8.5",
  text: "M5 7V5h14v2M12 5v14M9 19h6",
  note: "M5 4.5h14v9.5l-5 5.5H5zM14 19.5V14h5",
  eraser:
    "M9.5 19.5h10M4.8 14.2l8.9-8.9a2 2 0 0 1 2.8 0l2.2 2.2a2 2 0 0 1 0 2.8L11 18l-1.5 1.5H8.2l-3.4-3.4a1.4 1.4 0 0 1 0-1.9zM9 10l5 5",
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
