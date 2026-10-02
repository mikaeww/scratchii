# Verification: handwriting to text (experimental)

Covers `src/recognize/handwriting.ts` (strokes to an image, image to text with Tesseract) and the replacement
command `strokesToText` in `src/editor/commands.ts`.

## Claims

| # | Claim | Method | Oracle |
|---|---|---|---|
| W1 | Converting replaces exactly the chosen strokes with one text item at their top-left corner, in one undo step; undo brings every stroke back and removes the text | Property test, 300 random selections | The selection and the board before |
| W2 | The image handed to Tesseract contains every chosen stroke: dark pixels inside the stroke box, none outside it plus padding | Browser check in the running app | The stroke bounds |
| W3 | Block capitals drawn as pen strokes are read back; character accuracy on the corpus below is measured and reported, not promised | Headless browser, the real OCR path, `tools/ocr-check.ts` | The words that were drawn |

## Corpus

W3 uses 20 words written with a small single-line stroke alphabet (`tools/letters.ts`, capitals only), drawn
through the real pen tool with jitter. This is a proxy: neat block capitals, not real handwriting. Real
handwriting samples (owner's pen tablet and mouse) are the missing corpus.

## Thresholds

W1 and W2 100 %. W3 has no threshold; the measured character accuracy is reported as is.

## Results

| Claim | Date | Result |
|---|---|---|
| W1 | 2026-10-02 | 300 / 300 runs; in the running app 8 strokes of "IDEA" became one text "IDEA" and one undo brought all 8 back |
| W2 | 2026-10-02 | headless: 3282 ink pixels inside the stroke box, 0 outside |
| W3 | 2026-10-02 | 100.0 % character accuracy, 89 characters in 20 words, `node tools/ocr-check.ts`. Neat block capitals from the stroke alphabet only; says nothing yet about real handwriting |

## Known gaps

- Tesseract is trained on printed text; cursive or messy handwriting will often be misread.
- The result is always shown for confirmation and editing before anything is replaced.
- Only English and German models are bundled.
