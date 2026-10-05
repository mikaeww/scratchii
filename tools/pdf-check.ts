// Real check of the PDF import (docs/verification/study-tools/pdf.md) in the running app, headless: drops PDFs
// it writes itself onto the canvas, reads the placed pages back through the copy command and checks them.
// Usage: node tools/pdf-check.ts [SCREENSHOT.png]
import assert from "node:assert/strict";
import { chromium, type Page } from "playwright-core";
import { createServer } from "vite";
import { validateItem } from "../src/model/validate.ts";

const CHROME = process.env.CHROME ?? "/usr/bin/google-chrome-stable";

// A PDF of text pages in Helvetica, one of the standard fonts every reader has. Pages alternate between A4
// portrait and landscape so the aspect ratio is checked both ways.
function pdfWithPages(count: number): Buffer {
  const objects: string[] = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  const kids: string[] = [];
  for (let n = 1; n <= count; n++) {
    const [w, h] = n % 2 === 1 ? [595, 842] : [842, 595];
    const text = `BT /F1 48 Tf 72 ${h - 120} Td (Seite ${n}) Tj ET 72 72 m ${w - 72} 72 l S`;
    objects.push(`<< /Length ${text.length} >>\nstream\n${text}\nendstream`);
    const content = objects.length;
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /Resources << /Font << /F1 3 0 R >> >> /Contents ${content} 0 R >>`,
    );
    kids.push(`${objects.length} 0 R`);
  }
  objects[1] = `<< /Type /Pages /Kids [${kids.join(" ")}] /Count ${count} >>`;
  let body = "%PDF-1.4\n";
  const offsets = objects.map((object, i) => {
    const offset = body.length;
    body += `${i + 1} 0 obj\n${object}\nendobj\n`;
    return offset;
  });
  const xref = body.length;
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  body += offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("");
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(body, "latin1");
}

async function drop(page: Page, name: string, type: string, bytes: Buffer): Promise<void> {
  await page.evaluate(
    ({ name, type, base64 }) => {
      const data = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
      const transfer = new DataTransfer();
      transfer.items.add(new File([data], name, { type }));
      const canvas = document.querySelector("#canvas");
      canvas?.dispatchEvent(
        new DragEvent("drop", { dataTransfer: transfer, clientX: 640, clientY: 300, bubbles: true }),
      );
    },
    { name, type, base64: bytes.toString("base64") },
  );
}

// The selection after an import is exactly the placed pages; the copy command hands them out as JSON.
async function selectedItems(page: Page): Promise<unknown[]> {
  const json = await page.evaluate(() => {
    const transfer = new DataTransfer();
    document.dispatchEvent(new ClipboardEvent("copy", { clipboardData: transfer, bubbles: true }));
    return transfer.getData("text/plain");
  });
  return json === "" ? [] : (JSON.parse(json) as { items: unknown[] }).items;
}

async function toasts(page: Page): Promise<string> {
  return page.evaluate(() => [...document.querySelectorAll(".toast")].map((t) => t.textContent).join(" | "));
}

async function checkPages(page: Page, count: number): Promise<void> {
  await page.waitForFunction((n) => document.querySelectorAll(".toast").length > 0 && n > 0, count);
  await page.waitForFunction(
    () => {
      const transfer = new DataTransfer();
      document.dispatchEvent(new ClipboardEvent("copy", { clipboardData: transfer, bubbles: true }));
      return transfer.getData("text/plain") !== "";
    },
    undefined,
    { timeout: 60_000 },
  );
  const items = (await selectedItems(page)).map((value, i) => validateItem(value, `page ${i + 1}`));
  assert.equal(items.length, count, `P-1: ${items.length} pages placed, expected ${count}`);
  items.forEach((item, i) => {
    assert.ok(item.type === "image", "P-1: pages are pictures");
    const portrait = i % 2 === 0;
    const expected = portrait ? 842 / 595 : 595 / 842;
    assert.ok(Math.abs(item.height / item.width - expected) / expected < 0.01, `P-1: page ${i + 1} aspect`);
    assert.equal(item.width, 800);
    const next = items[i + 1];
    if (next !== undefined)
      assert.ok(next.y >= item.y + item.height, `P-1: page ${i + 2} overlaps page ${i + 1}`);
  });
}

async function main(): Promise<void> {
  const screenshot = process.argv[2];
  const server = await createServer({ logLevel: "error", server: { port: 5191, strictPort: false } });
  await server.listen();
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
    const requests: string[] = [];
    page.on("request", (request) => requests.push(request.url()));
    await page.goto(server.resolvedUrls?.local[0] ?? "", { waitUntil: "networkidle" });
    await page.waitForSelector(".panel.top");
    assert.ok(!requests.some((url) => url.includes("pdfjs")), "P-3: pdf.js loaded before any PDF arrived");
    console.log("P-3 ok: no pdf.js request before the import");

    await drop(page, "folien.pdf", "application/pdf", pdfWithPages(3));
    await checkPages(page, 3);
    console.log("P-1 + P-4 ok: 3 pages, in order, aspect within 1 %, no overlap, all valid");

    await page.click('[aria-label="Zoom out"]');
    await page.click('[aria-label="Zoom out"]');
    await page.click('[aria-label="Zoom out"]');
    if (screenshot !== undefined) await page.screenshot({ path: screenshot });

    await drop(page, "lang.pdf", "application/pdf", pdfWithPages(61));
    await page.waitForFunction(() => document.body.textContent.includes("60 / 61"), undefined, {
      timeout: 120_000,
    });
    assert.equal((await selectedItems(page)).length, 60, "P-2: more than 60 pages placed");
    console.log("P-2 ok: 61 pages gave 60 and a notice:", (await toasts(page)).split(" | ").at(-1));

    await drop(page, "kein.pdf", "application/pdf", Buffer.from("not a pdf at all"));
    await page.waitForFunction(() =>
      document.body.textContent.includes("kein.pdf could not be read as a PDF"),
    );
    // Nothing placed: the selection is still the 60 pages from before.
    assert.equal((await selectedItems(page)).length, 60, "P-2: a broken file placed something");
    console.log(
      "P-2 ok: a file that is no PDF failed with its name:",
      (await toasts(page)).split(" | ").at(-1),
    );
  } finally {
    await browser.close();
    await server.close();
  }
}

await main();
