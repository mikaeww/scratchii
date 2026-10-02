# Verification: files, export, library

Covers `src/model/file.ts` (the `.scratchii` format), `src/render/export/` (SVG, PNG, PDF) and
`src/storage/library.ts` (board summaries and search).

## Claims

| # | Claim | Method | Oracle |
|---|---|---|---|
| F1 | `parseFile(serialiseFile(board))` is deep-equal to the board for every generated board | Property test, 500 boards | The board itself |
| F2 | Files with another `format`, an unknown `version`, invalid JSON or an invalid board are rejected with an error that names the problem and, for board errors, the JSON path | Example per case plus the M2 mutations wrapped in a file | The mutation path |
| F3 | `pdfFromJpeg` produces a PDF that qpdf accepts without warnings, with one page whose size in points is the requested page size (CSS pixels) × 0.75 | Test over 3 page sizes using a committed JPEG fixture | `qpdf --check`, `pdfinfo` (independent implementations) |
| F4 | `svgDocument` produces well-formed SVG that a second renderer draws without error, with one `<path>` per path operation and the given view box | Test over 200 random boards of strokes, shapes and lines | `xmllint --noout`, `rsvg-convert` |
| F5 | Library search finds a board exactly when the query (case-insensitive, trimmed) occurs in its title, a tag, or the text of a live text or note item; deleted items never match | Property test, 500 boards × 5 queries | A direct scan written in the test |
| F6 | Importing a board whose id already exists in the library gives it a new id and leaves the stored board untouched | Example test on the pure `importAs` decision | Construction |

## Corpus

Generated boards (`tests/random.ts`); `tests/fixtures/pixel.jpg`: an 8 × 6 JPEG made with Pillow
(`Image.new("RGB", (8, 6), (255, 210, 63)).save("pixel.jpg", quality=90)`), size and hash noted in the fixture
README.

## Thresholds

100 % for every claim. F3 and F4 fail, never skip, when qpdf, pdfinfo, xmllint or rsvg-convert are missing.

## Results

| Claim | Date | Result |
|---|---|---|
| F1 | 2026-10-02 | 500 / 500 boards |
| F2 | 2026-10-02 | 5 / 5 cases rejected at the expected path |
| F3 | 2026-10-02 | 3 / 3 page sizes pass `qpdf --check` (exit 0) and `pdfinfo`; the first test version misread qpdf's closing note as an error |
| F4 | 2026-10-02 | 200 / 200 well-formed (xmllint), 10 / 10 rendered by rsvg-convert |
| F5 | 2026-10-02 | 3000 / 3000 queries |
| F6 | 2026-10-02 | passes |
| Real app | 2026-10-02 | headless: PNG, SVG, PDF and .scratchii downloads from the file menu (PDF passes qpdf, 1 page, 429 × 278.25 pt; SVG passes xmllint and rsvg); saved file reopened as a copy with a new id; library lists 3 boards with thumbnails; search "groceries" finds both copies; a dropped JPEG becomes a picture. Found and fixed: the file menu was positioned off screen (CSS order), and switching boards cancelled the left board's thumbnail |

## Known gaps

- The PDF is one raster page (JPEG), not vector; text in it is not selectable.
- SVG files embed the handwriting font as WOFF2. Browsers show it; renderers without web-font support (rsvg,
  as used in F4) fall back to a system font.
- PNG and PDF export need a browser canvas and are checked in the running app, not in Node.
