// Serves the built web app (dist/) so a browser can use Scratchii straight from the sync server.
// Every path is resolved and must stay inside the app directory; anything else is a 404.
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve, sep } from "node:path";

const TYPES: Readonly<Record<string, string>> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".woff2": "font/woff2",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".json": "application/json",
  ".txt": "text/plain; charset=utf-8",
};

export interface StaticFile {
  readonly body: Buffer;
  readonly type: string;
}

export async function staticFile(root: string, urlPath: string): Promise<StaticFile | null> {
  let decoded: string;
  try {
    decoded = decodeURIComponent(urlPath);
  } catch {
    // A malformed escape cannot name a file of the app.
    return null;
  }
  const base = resolve(root);
  const target = resolve(join(base, normalize(decoded === "/" ? "/index.html" : decoded)));
  if (target !== base && !target.startsWith(base + sep)) return null;
  try {
    if (!(await stat(target)).isFile()) return null;
    return { body: await readFile(target), type: TYPES[extname(target)] ?? "application/octet-stream" };
  } catch {
    // Missing or unreadable files are a plain 404 for the browser.
    return null;
  }
}
