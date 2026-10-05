# Conventions

Binding rules for Scratchii, derived from the `clean-project` skill. Deviations need an ADR in `decisions/`.

## Layout

- `src/` is the web app, one concept per directory: `model`, `geometry`, `render`, `editor`, `annotate`,
  `recognize`, `calc`, `table`, `diagram`, `templates`, `storage`, `sync`, `ui`. `src/main.ts` only wires them together.
- `server/` is the sync server; it imports `src/model` and nothing from the DOM side.
- `src-tauri/` is the desktop shell. It holds no app logic.
- `tests/` holds `node --test` files, one per concept, against the exported functions.
- `tools/` holds dev commands: `check.ts`, `structure.ts`, `render.ts`.
- `public/fonts/` holds the bundled OFL fonts with their licence files.

## Hard limits

| Limit | Value | Enforced by |
|---|---|---|
| Lines per handwritten file (code, docs, scripts, CSS) | 500 | `tools/structure.ts` |
| Code files per directory (entry `index.ts`, `main.ts` and tests excluded) | 8 | `tools/structure.ts` |
| Markdown files per docs directory, index included | 8 | `tools/structure.ts` |
| Directory depth below `src/` | 4 | `tools/structure.ts` |
| Lines per function | 60 | eslint `max-lines-per-function`, clippy `too_many_lines` |
| Parameters per function | 5 | eslint `max-params`, clippy `too_many_arguments` |

Forbidden module names: `utils`, `util`, `helpers`, `helper`, `misc`, `common`, `stuff`, `shared`.

## Code

- TypeScript `strict`, erasable syntax only, relative imports with the `.ts` extension.
- Every module starts with a comment saying what it is for and what not.
- No non-null assertions, no `any`, no `throw` of strings. Errors are `Error` subclasses per concept that name
  the file, element id or request they are about.
- Errors are never swallowed; a deliberate ignore carries a comment saying why.
- Input from outside (files, clipboard, sync requests, IndexedDB contents) goes through `src/model/validate.ts`.
  Unknown fields or versions are reported with their path, never guessed.
- Elements are immutable values; a change creates a new element with a higher `version`.
- Tests touch only directories and databases they created.

## Interface

- Colours, outlines, shadows, radii, spacing, font sizes and motion come only from the tokens in
  `src/ui/theme/tokens.css` (ADR 0002). Canvas drawing reads the same values through `src/render/ink.ts`.
- Neo Brutalism: black outlines, flat fills from the palette, hard offset shadows without blur. Radii in two
  steps, never pills. Pressed controls move into their shadow.
- Light only. Every control is reachable by keyboard and shows a visible focus ring; reduced motion removes
  travel and keeps the state change.
- Interface text is English by default, German selectable; every visible string goes through `src/ui/text.ts`.

## Workflow

1. Plan in the commit message, or in `docs/` for larger changes.
2. Implement in steps that keep the tree working.
3. `npm run check` must pass.
4. Real check: the running app (`npm run dev`, headless screenshots through `tools/render.ts`) or the real server.
5. Commit one logical step at a time with the docs it changes, naming how it was checked. No AI attribution.
