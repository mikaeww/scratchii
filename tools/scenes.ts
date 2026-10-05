// Steps shared by the render scenes, and the scenes of the study tools round (calculation, graphs, tables,
// connectors, diagrams, templates, bent arrows, docking). Used by tools/render.ts.
import type { Page } from "playwright-core";

export type Point = readonly [number, number];

// holdMs keeps the button down at the end, which makes the pen snap a recognised shape.
export async function stroke(page: Page, points: readonly Point[], holdMs = 0): Promise<void> {
  const [first, ...rest] = points;
  if (first === undefined) return;
  await page.mouse.move(...first);
  await page.mouse.down();
  for (const point of rest) await page.mouse.move(...point, { steps: 3 });
  if (holdMs > 0) await page.waitForTimeout(holdMs);
  await page.mouse.up();
}

export function wobblyBox(x: number, y: number, width: number, height: number): Point[] {
  const corners: Point[] = [
    [x, y],
    [x + width, y + 4],
    [x + width - 3, y + height],
    [x + 2, y + height - 3],
    [x + 4, y + 6],
  ];
  return corners.slice(1).flatMap((corner, i) => {
    const from = corners[i] ?? corner;
    return Array.from(
      { length: 8 },
      (_, k) =>
        [
          from[0] + ((corner[0] - from[0]) * k) / 8 + Math.sin(k) * 2,
          from[1] + ((corner[1] - from[1]) * k) / 8 + Math.cos(k) * 2,
        ] as const,
    );
  });
}

export function wave(x: number, y: number, width: number): Point[] {
  return Array.from({ length: 40 }, (_, i) => [x + (i / 39) * width, y + Math.sin(i / 3) * 10] as const);
}

export function loop(cx: number, cy: number, radius: number): Point[] {
  return Array.from({ length: 48 }, (_, i) => {
    const angle = (i / 44) * Math.PI * 2;
    return [cx + Math.cos(angle) * radius * 1.4, cy + Math.sin(angle) * radius] as const;
  });
}

export function polygonPath(corners: readonly Point[], perEdge = 10): Point[] {
  const closed = [...corners, ...corners.slice(0, 1)];
  return closed.slice(1).flatMap((corner, i) => {
    const from = closed[i] ?? corner;
    return Array.from(
      { length: perEdge },
      (_, k) =>
        [
          from[0] + ((corner[0] - from[0]) * k) / perEdge + Math.sin(k * 1.7) * 1.5,
          from[1] + ((corner[1] - from[1]) * k) / perEdge + Math.cos(k * 1.3) * 1.5,
        ] as const,
    );
  });
}

export function pentagram(cx: number, cy: number, radius: number): Point[] {
  return Array.from({ length: 5 }, (_, i) => {
    const angle = -Math.PI / 2 + (i * 4 * Math.PI) / 5;
    return [cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius] as const;
  });
}

export async function drag(page: Page, from: Point, to: Point): Promise<void> {
  await stroke(page, [from, to]);
}

export async function type(page: Page, at: Point, words: string): Promise<void> {
  await page.mouse.click(...at);
  await page.keyboard.type(words);
  await page.keyboard.press("Escape");
}

export async function tool(page: Page, key: string): Promise<void> {
  await page.keyboard.press(key);
}

// Swatches by position, so scenes work in every language: section 0 is ink, 1 is fill; the order is the
// palette order of src/ui/style-panel.ts.
export async function swatch(page: Page, section: 0 | 1, index: number): Promise<void> {
  await page.locator(".style-panel .swatches").nth(section).locator("button").nth(index).click();
}

// Typing "=" after maths: plain sums, a decimal comma, a conversion and a subnet.
async function calc(page: Page): Promise<void> {
  await tool(page, "t");
  const lines = ["Miete 450 + 120 =", "3,5 * 2^3 =", "255 in hex =", "192.168.10.0/26 ="];
  for (const [index, line] of lines.entries()) await type(page, [300, 200 + index * 70], line);
  await tool(page, "n");
  await type(page, [1000, 300], "Gebühr 12,50 * 4 =");
}

// Waits for the typed query and for the palette to close, so the next step never lands in the palette.
export async function command(page: Page, query: string): Promise<void> {
  await page.keyboard.press("Control+k");
  await page.waitForSelector(".palette[open] input");
  await page.keyboard.type(query);
  await page.waitForFunction(
    (q) => document.querySelector<HTMLInputElement>(".palette input")?.value === q,
    query,
  );
  await page.keyboard.press("Enter");
  await page.waitForSelector(".palette", { state: "hidden" });
}

// A bar chart and a function graph from the palette, the chart values typed into its dialog; each is moved
// aside with the select tool right after it lands in the middle.
async function graphs(page: Page): Promise<void> {
  await command(page, "balkendiagramm");
  await page.fill(".text-dialog-field", "Miete: 450\nStrom: 62,5\nEssen: 280\nHandy: 20\nRücklage: -40");
  await page.keyboard.press("Control+Enter");
  await tool(page, "v");
  await drag(page, [640, 400], [940, 400]);
  await command(page, "graph sin(x); x^2/4 - 3; 1/x");
  await tool(page, "v");
  await drag(page, [640, 400], [380, 400]);
  await page.mouse.click(1100, 180);
}

// A table from the palette filled with Tab and Enter, a bar chart from its right-click menu, and a second table
// pasted as tab-separated text the way a spreadsheet puts it on the clipboard.
async function tables(page: Page): Promise<void> {
  await command(page, "tabelle 4x3");
  await tool(page, "v");
  await drag(page, [640, 400], [380, 300]);
  await page.mouse.dblclick(200, 225);
  const cells = [
    "Fach",
    "Note",
    "ECTS",
    "Mathe",
    "1,7",
    "5",
    "BWL",
    "2,3",
    "5",
    "Netzwerktechnik",
    "1,3",
    "10",
  ];
  for (const cell of cells) {
    await page.keyboard.type(cell);
    await page.keyboard.press("Tab");
  }
  await page.keyboard.press("Escape");
  await page.mouse.click(200, 225, { button: "right" });
  await page.click("text=Bar chart from this table");
  await page.evaluate(() => {
    const data = new DataTransfer();
    data.setData(
      "text/plain",
      "Aufgabe\tFrist\tWer\nAntrag prüfen\t12.10.\tMika\nBescheid schreiben\t19.10.\tTeam",
    );
    document.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data }));
  });
  await page.mouse.click(1100, 180);
}

// A box and a diamond joined by an arrow drawn from inside one to inside the other; the diamond is then moved
// and the arrow follows. Labels are typed with a double-click on the box, the diamond and the arrow.
async function connectors(page: Page): Promise<void> {
  await tool(page, "r");
  await drag(page, [260, 300], [460, 420]);
  await tool(page, "d");
  await drag(page, [700, 280], [900, 440]);
  await tool(page, "a");
  await drag(page, [360, 360], [800, 360]);
  await tool(page, "v");
  await drag(page, [800, 330], [900, 600]);
  const labels: [Point, string][] = [
    [[360, 360], "Antrag eingegangen"],
    [[900, 630], "vollständig?"],
  ];
  for (const [[x, y], label] of labels) {
    await page.mouse.dblclick(x, y);
    await page.keyboard.type(label);
    await page.keyboard.press("Escape");
  }
  await page.mouse.click(1100, 180);
}

// The flowchart dialog from the palette with its starter text applied, seen zoomed out; then the network
// building block next to it. The last click lands on empty canvas, away from the zoom reset button.
async function diagrams(page: Page): Promise<void> {
  await command(page, "diagramm aus text");
  await page.keyboard.press("Control+Enter");
  await page.click('[aria-label="Zoom out"]');
  await page.click('[aria-label="Zoom out"]');
  await tool(page, "v");
  await drag(page, [640, 330], [430, 330]);
  await command(page, "baustein netzwerk");
  await drag(page, [640, 400], [880, 640]);
  await page.mouse.click(1100, 180);
}

// Squared paper with Cornell notes, then a week plan on lined paper, both from the palette, seen zoomed out.
async function templates(page: Page): Promise<void> {
  await command(page, "papier kariert");
  await command(page, "vorlage cornell");
  for (let i = 0; i < 3; i++) await page.click('[aria-label="Zoom out"]');
  await tool(page, "v");
  await drag(page, [640, 400], [470, 400]);
  await command(page, "papier liniert");
  await command(page, "vorlage wochenplan");
  await drag(page, [640, 400], [990, 300]);
  await page.mouse.click(1100, 700);
}

export function arc(from: Point, to: Point, bend: number, count = 24): Point[] {
  const [dx, dy] = [to[0] - from[0], to[1] - from[1]];
  const control: Point = [(from[0] + to[0]) / 2 - 2 * dy * bend, (from[1] + to[1]) / 2 + 2 * dx * bend];
  return Array.from({ length: count + 1 }, (_, i) => {
    const t = i / count;
    const [u, v, w] = [(1 - t) * (1 - t), 2 * (1 - t) * t, t * t];
    return [u * from[0] + v * control[0] + w * to[0], u * from[1] + v * control[1] + w * to[1]] as const;
  });
}

// Bent arrows with the pen, held still: one in one stroke, one with its head as a second stroke; a bent line;
// then a straight arrow from the tool, bent with its middle handle.
async function curves(page: Page): Promise<void> {
  await tool(page, "p");
  const oneStroke = arc([220, 420], [460, 260], 0.3);
  await stroke(page, [...oneStroke, [432, 252], [460, 260], [440, 284]], 700);
  await stroke(page, arc([560, 420], [800, 260], -0.3));
  await stroke(
    page,
    [
      [772, 254],
      [800, 260],
      [784, 286],
    ],
    700,
  );
  await stroke(page, arc([900, 420], [1140, 300], 0.25), 700);
  await tool(page, "a");
  await drag(page, [300, 620], [800, 620]);
  await tool(page, "v");
  await page.mouse.click(550, 620);
  await drag(page, [550, 620], [550, 520]);
}

// Docking: a pen arrow held between two boxes and a tool arrow to a third both attach; the middle box is then
// moved and both follow; a free arrow's end is dragged onto the right box and held there, so the highlight of
// the box it would attach to shows in the screenshot.
async function docking(page: Page): Promise<void> {
  await tool(page, "r");
  await drag(page, [180, 300], [360, 400]);
  await drag(page, [560, 300], [740, 400]);
  await drag(page, [940, 300], [1120, 400]);
  await tool(page, "p");
  await stroke(page, [...arc([360, 350], [560, 350], 0.25), [540, 336], [560, 350], [542, 366]], 700);
  await tool(page, "a");
  await drag(page, [650, 350], [1030, 350]);
  await tool(page, "v");
  await drag(page, [650, 305], [650, 205]);
  await tool(page, "a");
  await drag(page, [500, 620], [800, 620]);
  await tool(page, "v");
  await page.mouse.click(650, 620);
  await page.mouse.move(800, 620);
  await page.mouse.down();
  await page.mouse.move(1000, 380, { steps: 8 });
}

export const STUDY_SCENES: Readonly<Record<string, (page: Page) => Promise<void>>> = {
  calc,
  graphs,
  tables,
  connectors,
  diagrams,
  templates,
  curves,
  docking,
};
