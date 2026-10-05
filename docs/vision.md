# Vision

Scratchii is a scratchpad for thinking with a pen: a white surface for notes, sketches and quick diagrams that
looks like a person drew it, styled in Neo Brutalism. It exists because Excalidraw draws for you (every line is
a tool), and plain note apps do not draw at all. Scratchii starts from the pen and cleans up only when asked.

For one person first: someone on Linux who wants the same boards in the desktop app and in a browser, without
an account at someone else's service.

"Better" concretely means:

- **The pen comes first.** Drawing starts on the first pointer event, follows pressure, and never waits for a
  save or a sync.
- **Cleanup is a gesture, not a menu.** Holding the pen still turns a scribble into a shape; dragging the marker
  over text highlights it; a right-click underlines it.
- **Everything is in one style.** Shapes, notes, underlines and the interface share the same outlines, palette
  and handwriting; notes and interface panels cast the same hard shadows (ADR 0005).
- **Nothing gets lost.** Every edit is saved locally within a second; sync merges per element, so edits on two
  devices both survive.
- **It is yours.** Files are plain JSON, the sync server runs on your own machine, nothing is sent elsewhere.

Not a goal: live collaboration with cursors, an account system, AI features, mobile apps.
