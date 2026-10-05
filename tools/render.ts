// Headless screenshots of the real app with made-up drawings, for checks and the README. Never opens a window
// and runs in a fresh browser profile, so it cannot touch the owner's boards.
// Usage: node tools/render.ts OUT.png [scene] [WIDTHxHEIGHT]   scenes: see SCENES (an unknown one lists them)
import { chromium, type Page } from "playwright-core";
import { createServer } from "vite";

const CHROME = process.env.CHROME ?? "/usr/bin/google-chrome-stable";

type Point = readonly [number, number];

// holdMs keeps the button down at the end, which makes the pen snap a recognised shape.
async function stroke(page: Page, points: readonly Point[], holdMs = 0): Promise<void> {
  const [first, ...rest] = points;
  if (first === undefined) return;
  await page.mouse.move(...first);
  await page.mouse.down();
  for (const point of rest) await page.mouse.move(...point, { steps: 3 });
  if (holdMs > 0) await page.waitForTimeout(holdMs);
  await page.mouse.up();
}

function wobblyBox(x: number, y: number, width: number, height: number): Point[] {
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

function wave(x: number, y: number, width: number): Point[] {
  return Array.from({ length: 40 }, (_, i) => [x + (i / 39) * width, y + Math.sin(i / 3) * 10] as const);
}

function loop(cx: number, cy: number, radius: number): Point[] {
  return Array.from({ length: 48 }, (_, i) => {
    const angle = (i / 44) * Math.PI * 2;
    return [cx + Math.cos(angle) * radius * 1.4, cy + Math.sin(angle) * radius] as const;
  });
}

function polygonPath(corners: readonly Point[], perEdge = 10): Point[] {
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

function pentagram(cx: number, cy: number, radius: number): Point[] {
  return Array.from({ length: 5 }, (_, i) => {
    const angle = -Math.PI / 2 + (i * 4 * Math.PI) / 5;
    return [cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius] as const;
  });
}

async function drag(page: Page, from: Point, to: Point): Promise<void> {
  await stroke(page, [from, to]);
}

async function type(page: Page, at: Point, words: string): Promise<void> {
  await page.mouse.click(...at);
  await page.keyboard.type(words);
  await page.keyboard.press("Escape");
}

async function tool(page: Page, key: string): Promise<void> {
  await page.keyboard.press(key);
}

// Swatches by position, so scenes work in every language: section 0 is ink, 1 is fill; the order is the
// palette order of src/ui/style-panel.ts.
async function swatch(page: Page, section: 0 | 1, index: number): Promise<void> {
  await page.locator(".style-panel .swatches").nth(section).locator("button").nth(index).click();
}

async function board(page: Page): Promise<void> {
  await tool(page, "r");
  await drag(page, [260, 180], [520, 330]);
  await swatch(page, 1, 2);
  await tool(page, "o");
  await drag(page, [600, 190], [800, 330]);
  await tool(page, "a");
  await drag(page, [530, 260], [590, 260]);
  await tool(page, "n");
  await type(page, [960, 260], "Buy more yellow paint and call the print shop");
  await tool(page, "t");
  await type(page, [300, 450], "Scratchii plan");
  await swatch(page, 0, 3);
  await tool(page, "p");
  await stroke(page, wave(300, 510, 260));
}

const MARKS = ["Line", "Double line", "Wave", "Zigzag", "Marker", "Scribble", "Box", "Strike through"];

async function marks(page: Page): Promise<void> {
  await tool(page, "t");
  for (const [index, name] of MARKS.entries()) {
    const at: Point = [300 + (index % 2) * 420, 200 + Math.floor(index / 2) * 110];
    await type(page, at, `${name} on a text`);
    await page.mouse.click(at[0] + 20, at[1], { button: "right" });
    await page.click(`.mark-option[aria-label="${name}"]`);
  }
  await page.mouse.click(1100, 700);
}

async function recognise(page: Page): Promise<void> {
  await tool(page, "p");
  await stroke(page, wobblyBox(260, 180, 220, 130), 700);
  await stroke(page, loop(700, 250, 70), 700);
  await stroke(
    page,
    [
      [880, 250],
      [1000, 240],
      [1080, 245],
      [1050, 220],
      [1080, 245],
      [1052, 270],
    ],
    700,
  );
  await stroke(page, wave(260, 420, 260));
  await tool(page, "t");
  await type(page, [600, 430], "Highlight this line");
  await tool(page, "m");
  await swatch(page, 0, 2);
  await stroke(page, [
    [590, 432],
    [700, 430],
    [760, 433],
  ]);
  await swatch(page, 0, 5);
  await stroke(page, wave(260, 560, 300));
}

// The shape tools in the top row, the same shapes drawn with the pen and held still in the bottom row.
async function shapes(page: Page): Promise<void> {
  await swatch(page, 1, 0);
  const tools = ["r", "o", "3", "d", "s", "a"];
  for (const [index, key] of tools.entries()) {
    await tool(page, key);
    const x = 300 + index * 150;
    await drag(page, [x, 170], [x + 110, key === "a" ? 170 : 280]);
  }
  await tool(page, "p");
  await stroke(
    page,
    polygonPath([
      [330, 470],
      [400, 580],
      [270, 590],
    ]),
    700,
  );
  await stroke(
    page,
    loop(520, 520, 60).map(([x, y]) => [x - 0.4 * (x - 520), y] as const),
    700,
  );
  await stroke(
    page,
    polygonPath([
      [700, 440],
      [770, 520],
      [700, 600],
      [630, 520],
    ]),
    700,
  );
  await stroke(page, polygonPath(pentagram(890, 525, 75), 12), 700);
  await stroke(
    page,
    polygonPath([
      [1020, 470],
      [1150, 450],
      [1170, 560],
      [1040, 585],
    ]),
    700,
  );
  await stroke(page, wave(300, 680, 260));
}

// Typing "=" after maths: plain sums, a decimal comma, a conversion and a subnet.
async function calc(page: Page): Promise<void> {
  await tool(page, "t");
  const lines = ["Miete 450 + 120 =", "3,5 * 2^3 =", "255 in hex =", "192.168.10.0/26 ="];
  for (const [index, line] of lines.entries()) await type(page, [300, 200 + index * 70], line);
  await tool(page, "n");
  await type(page, [1000, 300], "Gebühr 12,50 * 4 =");
}

// Device preferences some scenes start with (see src/storage/preferences.ts).
const PREFERENCES: Readonly<Record<string, object>> = {
  german: { language: "de", grid: true },
  settings: { language: "de", grid: true },
};

const SCENES: Readonly<Record<string, (page: Page) => Promise<void>>> = {
  german: board,
  settings: async (page) => {
    await page.click(".sync-status");
  },
  recognise,
  shapes,
  calc,
  marks,
  menu: async (page) => {
    await tool(page, "t");
    await type(page, [420, 300], "Right-click me");
    await page.mouse.click(460, 300, { button: "right" });
  },
  pad: async (page) => {
    await tool(page, "t");
    await type(page, [420, 300], "Own underline");
    await page.mouse.click(460, 300, { button: "right" });
    await page.click("text=Draw your own…");
    const box = await page.locator(".pad").boundingBox();
    if (box === null) throw new Error("pad did not open");
    await stroke(page, wave(box.x + 90, box.y + 150, 340));
    await stroke(page, [
      [box.x + 90, box.y + 165],
      [box.x + 430, box.y + 160],
    ]);
  },
  board,
  selected: async (page) => {
    await board(page);
    await tool(page, "v");
    await page.mouse.click(390, 255);
  },
  empty: async () => {},
  doodle: async (page) => {
    await stroke(page, [
      [300, 300],
      [300, 420],
    ]);
    await stroke(page, [
      [300, 360],
      [360, 360],
    ]);
    await stroke(page, [
      [360, 300],
      [360, 420],
    ]);
    await stroke(page, [
      [400, 340],
      [400, 420],
    ]);
    await stroke(page, [
      [400, 310],
      [401, 312],
    ]);
    await stroke(page, wave(280, 470, 300));
    await stroke(page, loop(700, 380, 90));
  },
};

async function main(): Promise<void> {
  const [out, scene = "doodle", size = "1280x800"] = process.argv.slice(2);
  const draw = SCENES[scene];
  const [width, height] = size.split("x").map(Number);
  if (out === undefined || draw === undefined || width === undefined || height === undefined) {
    throw new Error(`usage: node tools/render.ts OUT.png [${Object.keys(SCENES).join("|")}] [WIDTHxHEIGHT]`);
  }
  const server = await createServer({ logLevel: "error", server: { port: 5190, strictPort: false } });
  await server.listen();
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 2 });
    const preferences = PREFERENCES[scene];
    if (preferences !== undefined) {
      await page.addInitScript((value) => {
        localStorage.setItem("scratchii.preferences", value);
      }, JSON.stringify(preferences));
    }
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    await page.goto(server.resolvedUrls?.local[0] ?? "", { waitUntil: "networkidle" });
    await page.waitForSelector(".panel.top");
    await draw(page);
    await page.waitForTimeout(300);
    await page.screenshot({ path: out });
    if (errors.length > 0) throw new Error(`page errors:\n${errors.join("\n")}`);
    console.log(`render: ${scene} ${width}x${height} → ${out}`);
  } finally {
    await browser.close();
    await server.close();
  }
}

await main();
