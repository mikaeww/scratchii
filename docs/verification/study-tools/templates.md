# Verification: templates and paper

Covers `src/templates/templates.ts` (Cornell notes, minutes, cheat sheet and week plan built from existing item
types) and the paper background (plain, dots, squares, lines) in `src/render/canvas.ts` and the preferences.

## Claims

| # | Claim | Method | Oracle |
|---|---|---|---|
| V1 | Every template is a non-empty list of items that pass validation unchanged, with unique ids, and nothing in it is a new item type | Example test per template, with English and German words | `validateItem` |
| V2 | Within a template, no two text items overlap and every text item lies inside the template's frame | Example test per template | Box arithmetic |
| V3 | Stored preferences from before (`grid: true` / `false`) read as dots / plain paper; an unknown paper value reads as plain | Example test | ADR 0002's grid preference |
| V4 | Each paper draws in the running app and the palette and settings switch it | Headless render of all four | The screenshots |

## Corpus

The four templates in both languages.

## Thresholds

All claims hold.

## Results

| Claim | Date | Result |
|---|---|---|
| V1 | 2026-10-05 | 4 templates × 2 languages, every item validates unchanged |
| V2 | 2026-10-05 | passes. First run: the German "Stichworte und Fragen" ran over the cue column into "Notizen"; the column is now about a third of the page |
| V3 | 2026-10-05 | 5 / 5 stored preferences |
| V4 | 2026-10-05 | headless: squared (`squares` scene), lined with Cornell notes and a week plan from the palette (`templates` scene), dotted (`german` scene). Found on the way: a palette closed and opened again quickly lost the focus of its new query to the late close event (also in the text dialog), and a drag in the empty middle of a selected template started a marquee; it now moves the selection |

## Known gaps

- Templates are placed once; they are ordinary items afterwards and do not reflow when edited.
- The paper is a device preference, not part of the board, so it does not travel with a file or through sync.
