# Agent instructions

Read `docs/conventions.md`, `docs/README.md` and the newest file in `docs/handoffs/` before changing anything.
`npm run check` must pass before every commit. Tests never touch the user's IndexedDB, boards or sync server;
they create their own temporary directories and databases. `tools/render.ts` takes screenshots headlessly, never
in a visible window.
