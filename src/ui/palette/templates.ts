// Palette commands for page templates and the paper background. The template words come from the interface
// text, lists separated by "|".
import { insertAt } from "../../editor/commands.ts";
import { PAPERS } from "../../render/canvas.ts";
import { TEMPLATES, buildTemplate, type TemplateWords } from "../../templates/templates.ts";
import { text, type TextKey } from "../text.ts";
import type { PaletteContext } from "./commands.ts";
import type { Command } from "./rank.ts";

function list(key: TextKey): string[] {
  return text(key).split("|");
}

function templateWords(): TemplateWords {
  return {
    cornellTitle: text("template.cornellTitle"),
    cues: text("template.cues"),
    notes: text("template.notes"),
    summary: text("template.summary"),
    minutes: text("template.minutes"),
    minutesFields: list("template.minutesFields"),
    agenda: list("template.agenda"),
    cheatsheet: text("template.cheatsheet"),
    cheatsheetColumns: list("template.cheatsheetColumns"),
    week: text("template.week"),
    days: list("template.days"),
    time: text("template.time"),
  };
}

const TEMPLATE_WORDS = {
  cornell: ["vorlage cornell", "cornell", "mitschrift", "vorlesung", "lecture"],
  minutes: ["vorlage protokoll", "protokoll", "minutes", "sitzung", "meeting"],
  cheatsheet: ["vorlage spickzettel", "spickzettel", "cheat sheet", "lernzettel", "klausur"],
  week: ["vorlage wochenplan", "wochenplan", "stundenplan", "week", "timetable"],
} as const;

const PAPER_WORDS = {
  plain: ["papier leer", "blank", "ohne raster"],
  dots: ["papier punkte", "punktraster", "dotted"],
  squares: ["papier kariert", "kariert", "karo", "grid"],
  lines: ["papier liniert", "liniert", "lined"],
} as const;

export function templateCommands({ editor, centre, setPaper }: PaletteContext): Command[] {
  const templates = TEMPLATES.map((template) => ({
    id: `template.${template}`,
    label: text(`palette.template.${template}`),
    words: TEMPLATE_WORDS[template],
    run: () => {
      const { color, size } = editor.style;
      insertAt(editor, buildTemplate(template, templateWords(), { color, size }), centre());
    },
  }));
  const papers = PAPERS.map((paper) => ({
    id: `paper.${paper}`,
    label: `${text("settings.paper")}: ${text(`paper.${paper}`)}`,
    words: PAPER_WORDS[paper],
    run: () => {
      setPaper(paper);
    },
  }));
  return [...templates, ...papers];
}
