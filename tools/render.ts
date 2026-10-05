// Headless screenshots of the real app with made-up drawings, for checks and the README. Never opens a window
// and runs in a fresh browser profile, so it cannot touch the owner's boards.
// Usage: node tools/render.ts OUT.png [scene] [WIDTHxHEIGHT]   scenes: see SCENES (an unknown one lists them)
import { chromium, type Page } from "playwright-core";
import { createServer } from "vite";
import {
  STUDY_SCENES,
  stroke,
  wobblyBox,
  wave,
  loop,
  polygonPath,
  pentagram,
  drag,
  type,
  tool,
  swatch,
  type Point,
} from "./scenes.ts";

const CHROME = process.env.CHROME ?? "/usr/bin/google-chrome-stable";

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

// Device preferences some scenes start with (see src/storage/preferences.ts).
const PREFERENCES: Readonly<Record<string, object>> = {
  german: { language: "de", paper: "dots" },
  settings: { language: "de", paper: "dots" },
  squares: { language: "de", paper: "squares" },
};

const SCENES: Readonly<Record<string, (page: Page) => Promise<void>>> = {
  ...STUDY_SCENES,
  german: board,
  settings: async (page) => {
    await page.click(".sync-status");
  },
  recognise,
  shapes,
  insert: async (page) => {
    await page.click('[aria-label^="Insert"]');
  },
  squares: board,
  palette: async (page) => {
    await page.keyboard.press("Control+k");
    await page.keyboard.type("kre");
  },
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
