import assert from "node:assert/strict";
import { test } from "node:test";
import { shapeBox } from "../src/geometry/bounds.ts";
import { validateItem } from "../src/model/validate.ts";
import { TEMPLATES, buildTemplate, type TemplateWords } from "../src/templates/templates.ts";
import { ENGLISH } from "../src/ui/language/english.ts";
import { GERMAN } from "../src/ui/language/german.ts";

function words(dictionary: Readonly<Record<string, string>>): TemplateWords {
  const word = (key: string): string => dictionary[`template.${key}`] ?? "";
  const list = (key: string): string[] => word(key).split("|");
  return {
    cornellTitle: word("cornellTitle"),
    cues: word("cues"),
    notes: word("notes"),
    summary: word("summary"),
    minutes: word("minutes"),
    minutesFields: list("minutesFields"),
    agenda: list("agenda"),
    cheatsheet: word("cheatsheet"),
    cheatsheetColumns: list("cheatsheetColumns"),
    week: word("week"),
    days: list("days"),
    time: word("time"),
  };
}

const LANGUAGES = [words(ENGLISH), words(GERMAN)];

test("V1: every template is valid items of existing types with unique ids", () => {
  for (const language of LANGUAGES) {
    for (const template of TEMPLATES) {
      const items = buildTemplate(template, language, { color: "ink", size: "m" });
      assert.ok(items.length > 0, template);
      assert.equal(new Set(items.map((item) => item.id)).size, items.length, template);
      for (const item of items) {
        const json: unknown = JSON.parse(JSON.stringify(item));
        assert.deepEqual(validateItem(json, "item"), item, `${template} ${item.type}`);
      }
    }
  }
});

test("V2: texts in a template do not overlap and stay inside its frame", () => {
  for (const language of LANGUAGES) {
    for (const template of TEMPLATES) {
      const items = buildTemplate(template, language, { color: "ink", size: "m" });
      const texts = items.filter((item) => item.type === "text").map(shapeBox);
      const frame = items[0]?.type === "rect" ? shapeBox(items[0]) : null;
      texts.forEach((a, i) => {
        if (frame !== null) {
          const inside =
            a.x >= frame.x &&
            a.y >= frame.y &&
            a.x + a.width <= frame.x + frame.width &&
            a.y + a.height <= frame.y + frame.height;
          assert.ok(inside, `${template}: text ${i} leaves the frame`);
        }
        texts.slice(i + 1).forEach((b) => {
          const apart =
            a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y;
          assert.ok(apart, `${template}: texts overlap`);
        });
      });
    }
  }
});

test("V3: the old dot grid preference reads as dots or plain paper; unknown papers read as plain", async () => {
  const stored = new Map<string, string>();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (key: string) => stored.get(key) ?? null,
    setItem: (key: string, value: string) => stored.set(key, value),
  };
  const { readPreferences } = await import("../src/storage/preferences.ts");
  for (const [saved, paper] of [
    [{ grid: true }, "dots"],
    [{ grid: false }, "plain"],
    [{}, "plain"],
    [{ paper: "squares", grid: true }, "squares"],
    [{ paper: "wallpaper" }, "plain"],
  ] as const) {
    stored.set("scratchii.preferences", JSON.stringify(saved));
    assert.equal(readPreferences().paper, paper, JSON.stringify(saved));
  }
});
