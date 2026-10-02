// Headless screenshots of the real app with made-up drawings, for checks and the README. Never opens a window
// and runs in a fresh browser profile, so it cannot touch the owner's boards.
// Usage: node tools/render.ts OUT.png [scene] [WIDTHxHEIGHT]   scenes: empty, doodle
import { chromium, type Page } from "playwright-core";
import { createServer } from "vite";

const CHROME = process.env.CHROME ?? "/usr/bin/google-chrome-stable";

type Point = readonly [number, number];

async function stroke(page: Page, points: readonly Point[]): Promise<void> {
  const [first, ...rest] = points;
  if (first === undefined) return;
  await page.mouse.move(...first);
  await page.mouse.down();
  for (const point of rest) await page.mouse.move(...point, { steps: 3 });
  await page.mouse.up();
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

const SCENES: Readonly<Record<string, (page: Page) => Promise<void>>> = {
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
