# 0002: Neo Brutalism, light only

**Status:** accepted
**Date:** 2026-10-02

## Context
The clean-project design language asks for neutral grey, no borders, no shadows, no colour accents and both a
dark and a light theme. The owner asked for the opposite on purpose: a clean white drawing surface with Neo
Brutalism everywhere, in the chrome and in what is drawn: thick black outlines, flat vivid fills, hard offset
shadows, and handwritten text.

## Options
- Follow clean-project and keep Neo Brutalism only on the canvas. Rejected by the owner.
- Neo Brutalism everywhere, light and dark.
- Neo Brutalism everywhere, light only.

## Decision
Neo Brutalism everywhere, light only, overriding these clean-project rules for this project: colour accents are
allowed from the fixed palette in `src/ui/theme.css`, black outlines and hard offset shadows are the structure,
and there is no dark theme. Everything else from clean-project stays: values only as tokens, one font scale and
one spacing scale, two radius steps (no pills), equal padding on all sides, one primary action per context,
visible keyboard focus, sufficient contrast, reduced motion.

Fonts: Shantell Sans for everything drawn on the canvas, Space Grotesk for the interface; both are OFL and
bundled in `public/fonts`, so the app looks the same on every machine.

## Consequences
- No theme switch to build or test.
- A dark theme later needs a new ADR and a second palette, including canvas ink colours.
- Shadows are hard offsets only: no blur, no glow.
