# Verification: PDF import

Covers `src/import/pdf.ts` (pages of a PDF as pictures) and its entry points: dropping or pasting a PDF and the
palette command (ADR 0008).

## Claims

| # | Claim | Method | Oracle |
|---|---|---|---|
| P-1 | A PDF of n ≤ 60 pages becomes n picture items in page order, stacked top to bottom without overlap, each 800 units wide with the page's aspect ratio (within 1 %) | Headless run in the real app (`node tools/pdf-check.ts`) with a generated 3-page PDF | The page sizes in the PDF |
| P-2 | A PDF of more than 60 pages places 60 and says so; a file that is no PDF fails with a message naming it and places nothing | Headless run with a 61-page PDF and a renamed text file | The notice and the item count |
| P-3 | pdf.js is not loaded until a PDF arrives | Network log of the headless run: no pdf.js request before the import | The request list |
| P-4 | Every placed page passes validation (data URL type and size limit) | The pages read back from the board in the headless run | `validateItem` |

## Corpus

PDFs written by a small writer in `tools/pdf-check.ts` (Helvetica text pages, A4 portrait and landscape
alternating), generated in the check, so no outside files are needed; page counts 3 and 61, and a text file
named `.pdf`. Scratchii's own export writes one page only, so it could not provide the multi-page cases.

## Thresholds

All claims hold.

## Results

| Claim | Date | Result |
|---|---|---|
| P-1, P-4 | 2026-10-05 | 3 pages placed in order, portrait and landscape within 1 %, no overlap, all valid. First version of the check waited on an async function, which Playwright counts as true at once |
| P-2 | 2026-10-05 | 61 pages gave 60 and the notice "Only the first pages were placed: 60 / 61"; a text file named kein.pdf failed with "kein.pdf could not be read as a PDF: Invalid PDF structure." and placed nothing |
| P-3 | 2026-10-05 | no pdf.js request before the first import; the production build puts pdf.js (431 kB) and its worker (1.26 MB) in their own files next to a 150 kB app |
| Real app | 2026-10-05 | the screenshot showed a white page on the white canvas without an edge; pictures now get a faint outline |

## Known gaps

- Pages are pictures; their text is not searchable or selectable.
- Password-protected PDFs fail with pdf.js's message.
