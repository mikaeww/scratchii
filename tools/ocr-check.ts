// Measures handwriting recognition (docs/verification/handwriting.md, W2 and W3) in a headless browser:
// words written with the stroke alphabet through the real pen, read through the real OCR path.
// Usage: node tools/ocr-check.ts
import { chromium, type Page } from "playwright-core";
import { createServer } from "vite";
import type { StrokeItem } from "../src/model/item.ts";
import { LETTERS, WORDS } from "./letters.ts";

const CHROME = process.env.CHROME ?? "/usr/bin/google-chrome-stable";
const LETTER_HEIGHT = 70;
const SPACING = 62;

function distance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let previous = row[0] ?? 0;
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const current = row[j] ?? 0;
      row[j] = Math.min(current + 1, (row[j - 1] ?? 0) + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
      previous = current;
    }
  }
  return row[b.length] ?? 0;
}

async function write(page: Page, word: string, wobble: () => number): Promise<void> {
  for (const [index, letter] of Array.from(word).entries()) {
    for (const stroke of LETTERS[letter] ?? []) {
      const points = stroke.map(
        ([x, y]) =>
          [300 + index * SPACING + x * LETTER_HEIGHT + wobble(), 300 + y * LETTER_HEIGHT + wobble()] as const,
      );
      const [first, ...rest] = points;
      if (first === undefined) continue;
      await page.mouse.move(...first);
      await page.mouse.down();
      for (const point of rest) await page.mouse.move(...point, { steps: 6 });
      await page.mouse.up();
    }
  }
}

async function imageCheck(page: Page): Promise<string> {
  return page.evaluate(async () => {
    // These paths are served by Vite inside the page; the casts give them their real types.
    const handwriting = "/src/recognize/handwriting.ts";
    const model = "/src/model/item.ts";
    const { strokesImage, strokesBox } = (await import(
      handwriting
    )) as typeof import("../src/recognize/handwriting.ts");
    const { createItem } = (await import(model)) as typeof import("../src/model/item.ts");
    const strokes = Array.from({ length: 5 }, (_, i) =>
      createItem<StrokeItem>({
        type: "stroke",
        x: 100 + i * 40,
        y: 50,
        color: "ink",
        size: "m",
        points: [
          [0, 0, 0.5],
          [20, 60, 0.5],
        ],
        pressure: false,
        tip: "pen",
      }),
    );
    const image = strokesImage(strokes);
    const box = strokesBox(strokes);
    if (image === null || box === null) return "no image";
    const data =
      image.getContext("2d")?.getImageData(0, 0, image.width, image.height).data ?? new Uint8ClampedArray();
    // The picture is the stroke box scaled, plus 24 px padding on each side; ink may only sit inside the box.
    const scale = (image.width - 48) / box.width;
    let inside = 0;
    let outside = 0;
    for (let i = 0; i < data.length; i += 4) {
      if ((data[i] ?? 255) >= 128) continue;
      const x = (i / 4) % image.width;
      const y = Math.floor(i / 4 / image.width);
      const within = x >= 23 && x <= 25 + box.width * scale && y >= 23 && y <= 25 + box.height * scale;
      if (within) inside++;
      else outside++;
    }
    return `image ${image.width}x${image.height}, ink pixels inside the stroke box ${inside}, outside ${outside}`;
  });
}

async function main(): Promise<void> {
  const server = await createServer({ logLevel: "error", server: { port: 5191, strictPort: false } });
  await server.listen();
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1400, height: 800 } });
    await page.goto(server.resolvedUrls?.local[0] ?? "", { waitUntil: "networkidle" });
    await page.waitForSelector(".panel.top");
    console.log(`W2: ${await imageCheck(page)}`);
    let seed = 7;
    const wobble = (): number => ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5) * 6;
    let errors = 0;
    let characters = 0;
    for (const word of WORDS) {
      await page.keyboard.press("p");
      await write(page, word, wobble);
      await page.keyboard.press("v");
      await page.keyboard.press("Control+a");
      // Right-click on the middle of the first stroke, so the click lands on ink, not inside a letter.
      const [[ax, ay] = [0, 0], [bx, by] = [0, 0]] = LETTERS[word[0] ?? ""]?.[0] ?? [];
      await page.mouse.click(300 + ((ax + bx) / 2) * LETTER_HEIGHT, 300 + ((ay + by) / 2) * LETTER_HEIGHT, {
        button: "right",
      });
      await page.click("text=Convert handwriting to text");
      await page.waitForFunction(
        () =>
          document.querySelector<HTMLTextAreaElement>(".ocr-text")?.hidden === false ||
          document.querySelector("dialog[open] .dialog-hint")?.textContent.includes("No text") === true,
        null,
        { timeout: 60_000 },
      );
      const read = (await page.inputValue(".ocr-text")).replace(/\s+/g, "").toUpperCase();
      const wrong = distance(read, word);
      errors += wrong;
      characters += word.length;
      console.log(`W3: ${word.padEnd(8)} read "${read}" (${wrong} edits)`);
      await page.click("dialog[open] >> text=Cancel");
      await page.keyboard.press("Control+a");
      await page.keyboard.press("Delete");
    }
    console.log(
      `W3: character accuracy ${(100 * (1 - errors / characters)).toFixed(1)} % over ${characters} characters, ${WORDS.length} words`,
    );
  } finally {
    await browser.close();
    await server.close();
  }
}

await main();
