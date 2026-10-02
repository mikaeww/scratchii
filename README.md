# Scratchii

A scratchpad for notes and sketches on a clean white surface, where everything looks drawn by hand and styled in
Neo Brutalism: thick black outlines, flat bright colours, hard shadows and handwritten text. It runs in the browser
and as a desktop app on Linux. Written in TypeScript, with a small Tauri shell for the desktop.

Boards stay on your machine. Sync goes only to a server you run yourself.

> [!NOTE]
> Scratchii is in early development. None of the features below are usable yet; see the
> [roadmap](docs/roadmap.md) for what is done.

## Features

- A pen that follows pen pressure and feels like a felt marker
- Boxes, ellipses, lines, arrows, text and sticky notes, all in the same hand-drawn style
- Hold the pen still at the end of a scribble and it becomes a clean shape
- Drag the marker over text to highlight that line
- Right-click a text to underline it with one of eight hand-drawn styles, or draw your own
- Handwriting to typed text, offline (experimental)
- A library of all boards with search, tags and thumbnails
- Open and save `.scratchii` files, export as PNG, SVG or PDF
- Sync between the desktop app and a browser through your own small server

## Run it

Needs Node.js 24 or newer.

```sh
git clone https://github.com/mikaeww/scratchii.git
cd scratchii
npm install
npm run dev
```

`npm run dev` prints a local address to open in the browser. The desktop app and the sync server come in later
phases of the [build plan](docs/plans/2026-10-02-buildplan.md).

## Check

```sh
npm run check     # format, lint, types, structure limits, tests
```

The app is in `src/`, the dev commands are in `tools/`. Conventions, decisions and verification plans are in
[docs/](docs/README.md).

## License

MIT
