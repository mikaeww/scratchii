// Page templates built from the item types that exist: frames, lines, texts and tables. Cornell notes, minutes,
// a cheat sheet and a week plan, in the words the caller passes (the interface language). Pure; the caller
// places the items. Not here: anything that stays linked after placing; templates are plain items afterwards.
import { LINE_HEIGHT } from "../geometry/widths.ts";
import {
  createItem,
  type Color,
  type Item,
  type LineItem,
  type ShapeItem,
  type Size,
  type TableItem,
  type TextItem,
} from "../model/item.ts";

export const TEMPLATES = ["cornell", "minutes", "cheatsheet", "week"] as const;
export type Template = (typeof TEMPLATES)[number];

export interface TemplateWords {
  readonly cornellTitle: string;
  readonly cues: string;
  readonly notes: string;
  readonly summary: string;
  readonly minutes: string;
  readonly minutesFields: readonly string[];
  readonly agenda: readonly string[];
  readonly cheatsheet: string;
  readonly cheatsheetColumns: readonly string[];
  readonly week: string;
  readonly days: readonly string[];
  readonly time: string;
}

interface Style {
  readonly color: Color;
  readonly size: Size;
}

const HEADING = 30;
const LABEL = 20;
const ROW = 46;
// A rough width for text not yet measured: Shantell Sans averages a little over half its size per character.
// The real size is measured the first time the text is edited.
const CHARACTER = 0.58;

function textItem(content: string, at: readonly [number, number], fontSize: number, style: Style): TextItem {
  const lines = content.split("\n");
  return createItem<TextItem>({
    type: "text",
    x: at[0],
    y: at[1],
    ...style,
    text: content,
    fontSize,
    width: Math.max(...lines.map((line) => line.length)) * fontSize * CHARACTER,
    height: lines.length * fontSize * LINE_HEIGHT,
  });
}

function frame(box: readonly [number, number, number, number], style: Style): ShapeItem {
  const [x, y, width, height] = box;
  return createItem<ShapeItem>({ type: "rect", x, y, width, height, ...style, fill: null, label: "" });
}

function rule(from: readonly [number, number], to: readonly [number, number], style: Style): LineItem {
  return createItem<LineItem>({
    type: "line",
    x: from[0],
    y: from[1],
    ...style,
    points: [
      [0, 0],
      [to[0] - from[0], to[1] - from[1]],
    ],
    label: "",
    ends: [null, null],
    bend: 0,
  });
}

function table(
  cells: readonly (readonly string[])[],
  at: readonly [number, number],
  widths: readonly number[],
  style: Style,
): TableItem {
  const width = widths.reduce((a, b) => a + b, 0);
  return createItem<TableItem>({
    type: "table",
    x: at[0],
    y: at[1],
    ...style,
    width,
    height: cells.length * ROW,
    cells,
    columns: widths.map((w) => w / width),
    rows: cells.map(() => 1 / cells.length),
  });
}

function cornell(words: TemplateWords, style: Style): Item[] {
  // The cue column takes about a third of the page, as in the Cornell method.
  const [width, height, cue, summary] = [840, 1100, 290, 880];
  return [
    frame([0, 0, width, height], style),
    textItem(words.cornellTitle, [20, 22], HEADING, style),
    rule([0, 90], [width, 90], style),
    rule([cue, 90], [cue, summary], style),
    rule([0, summary], [width, summary], style),
    textItem(words.cues, [20, 104], LABEL, style),
    textItem(words.notes, [cue + 20, 104], LABEL, style),
    textItem(words.summary, [20, summary + 14], LABEL, style),
  ];
}

function minutes(words: TemplateWords, style: Style): Item[] {
  const header = words.minutesFields.map((field) => [field, ""]);
  const agenda = [words.agenda, ...["1", "2", "3"].map((n) => [n, ...words.agenda.slice(1).map(() => "")])];
  const agendaTop = 90 + header.length * ROW + 40;
  return [
    frame([0, 0, 900, agendaTop + agenda.length * ROW + 40], style),
    textItem(words.minutes, [20, 22], HEADING, style),
    table(header, [20, 90], [220, 640], style),
    table(agenda, [20, agendaTop], [70, 330, 260, 100, 100], style),
  ];
}

function cheatsheet(words: TemplateWords, style: Style): Item[] {
  const column = 280;
  return [
    frame([0, 0, 3 * column + 80, 1000], style),
    textItem(words.cheatsheet, [20, 22], HEADING, style),
    ...words.cheatsheetColumns.flatMap((heading, i) => [
      frame([20 + i * (column + 20), 90, column, 890], style),
      textItem(heading, [36 + i * (column + 20), 104], LABEL, style),
    ]),
  ];
}

function week(words: TemplateWords, style: Style): Item[] {
  const times = ["08:00", "10:00", "12:00", "14:00", "16:00", "18:00"];
  const cells = [[words.time, ...words.days], ...times.map((time) => [time, ...words.days.map(() => "")])];
  return [
    textItem(words.week, [0, 0], HEADING, style),
    table(cells, [0, 68], [90, ...words.days.map(() => 130)], style),
  ];
}

export function buildTemplate(template: Template, words: TemplateWords, style: Style): Item[] {
  switch (template) {
    case "cornell":
      return cornell(words, style);
    case "minutes":
      return minutes(words, style);
    case "cheatsheet":
      return cheatsheet(words, style);
    case "week":
      return week(words, style);
  }
}
