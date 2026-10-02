// Copies the OCR engine and language data from node_modules into public/ocr/, so handwriting recognition
// works offline and inside the desktop app. Runs before `npm run dev` and `npm run build`; the copies are
// build output and stay out of git.
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const target = join(root, "public", "ocr");
const modules = join(root, "node_modules");

// tesseract.js picks the core by CPU features; these are the LSTM-only builds for each feature level.
const files: [string, string][] = [
  ["tesseract.js/dist/worker.min.js", "worker.min.js"],
  ["tesseract.js-core/tesseract-core-lstm.wasm.js", "tesseract-core-lstm.wasm.js"],
  ["tesseract.js-core/tesseract-core-simd-lstm.wasm.js", "tesseract-core-simd-lstm.wasm.js"],
  ["tesseract.js-core/tesseract-core-relaxedsimd-lstm.wasm.js", "tesseract-core-relaxedsimd-lstm.wasm.js"],
  ["@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz", "eng.traineddata.gz"],
  ["@tesseract.js-data/deu/4.0.0_best_int/deu.traineddata.gz", "deu.traineddata.gz"],
];

mkdirSync(target, { recursive: true });
for (const [source, name] of files) {
  const from = join(modules, source);
  if (!existsSync(from)) throw new Error(`ocr-assets: ${source} is missing; run npm install`);
  copyFileSync(from, join(target, name));
}
console.log(`ocr-assets: ${files.length} files in public/ocr`);
