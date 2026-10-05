// Every command the palette offers. Each feature adds its own here; the palette itself only ranks and runs.
import { insertAt } from "../../editor/commands.ts";
import type { Editor, ToolName } from "../../editor/editor.ts";
import type { Vec } from "../../editor/viewport.ts";
import { createItem, type ChartItem, type GraphItem } from "../../model/item.ts";
import { MAX_FUNCTIONS } from "../../model/validate.ts";
import { BUILDING_BLOCKS, DIAGRAM_STARTER } from "../../diagram/blocks.ts";
import { diagramRequest, placeDiagram } from "../editing/diagrams.ts";
import { placeTable, tableSize } from "../editing/tables.ts";
import { chartRequest } from "../menus/item-text.ts";
import type { Paper } from "../../render/canvas.ts";
import type { TextRequest } from "../menus/text-dialog.ts";
import { templateCommands } from "./templates.ts";
import { text } from "../text.ts";
import type { Command } from "./rank.ts";

export interface PaletteContext {
  readonly editor: Editor;
  // The world point in the middle of the visible canvas, where inserted things land.
  readonly centre: () => Vec;
  readonly openText: (request: TextRequest) => void;
  // Shows and remembers the paper background.
  readonly setPaper: (paper: Paper) => void;
}

const GRAPH_SIZE = { width: 480, height: 320 } as const;
const CHART_SIZE = { width: 480, height: 300 } as const;

const TOOL_WORDS: Readonly<Record<ToolName, readonly string[]>> = {
  select: ["auswählen", "select", "auswahl"],
  hand: ["hand", "verschieben", "pan"],
  pen: ["stift", "pen", "zeichnen", "draw"],
  marker: ["marker", "textmarker", "highlighter"],
  rect: ["rechteck", "rectangle", "box", "kasten", "quadrat", "square"],
  ellipse: ["kreis", "circle", "ellipse", "oval"],
  triangle: ["dreieck", "triangle"],
  diamond: ["raute", "diamond", "rhombus", "entscheidung"],
  star: ["stern", "star"],
  line: ["linie", "line", "strich"],
  arrow: ["pfeil", "arrow", "verbinder", "connector"],
  text: ["text", "schrift", "tippen", "type"],
  note: ["notiz", "zettel", "note", "sticky"],
  eraser: ["radierer", "radiergummi", "eraser"],
};

function toolCommands({ editor }: PaletteContext): Command[] {
  return (Object.keys(TOOL_WORDS) as ToolName[]).map((tool) => ({
    id: `tool.${tool}`,
    label: text(`tool.${tool}`),
    words: TOOL_WORDS[tool],
    run: () => {
      editor.setTool(tool);
    },
  }));
}

function graphCommands({ editor, centre, openText }: PaletteContext): Command[] {
  const chart = (kind: ChartItem["kind"]): void => {
    const item = createItem<ChartItem>({
      type: "chart",
      x: 0,
      y: 0,
      color: "ink",
      size: "m",
      ...CHART_SIZE,
      kind,
      labels: ["A", "B", "C"],
      values: [3, 5, 2],
    });
    insertAt(editor, [item], centre());
    openText(chartRequest(editor, item));
  };
  return [
    {
      id: "insert.graph",
      label: text("palette.graph"),
      words: ["graph", "funktion", "function", "plot", "funktionsgraph"],
      argument: "sin(x); x^2",
      run: (argument) => {
        const functions = (argument || "sin(x)")
          .split(";")
          .map((f) => f.trim())
          .filter((f) => f !== "");
        const item = createItem<GraphItem>({
          type: "graph",
          x: 0,
          y: 0,
          color: "ink",
          size: "m",
          ...GRAPH_SIZE,
          functions: functions.slice(0, MAX_FUNCTIONS),
          range: [-10, 10, -6, 6],
        });
        insertAt(editor, [item], centre());
      },
    },
    {
      id: "insert.bars",
      label: text("palette.bars"),
      words: ["balkendiagramm", "bar chart", "balken", "säulen", "diagramm", "chart"],
      run: () => {
        chart("bar");
      },
    },
    {
      id: "insert.lineChart",
      label: text("palette.lineChart"),
      words: ["liniendiagramm", "line chart", "verlauf", "kurve"],
      run: () => {
        chart("line");
      },
    },
  ];
}

function tableCommand({ editor, centre }: PaletteContext): Command {
  return {
    id: "insert.table",
    label: text("palette.table"),
    words: ["tabelle", "table", "raster", "grid", "matrix"],
    argument: text("palette.tableArgument"),
    run: (argument) => {
      const [rows, columns] = tableSize(argument);
      const cells = Array.from({ length: rows }, () => Array.from({ length: columns }, () => ""));
      placeTable(editor, cells, centre());
    },
  };
}

const BLOCK_WORDS: Readonly<Record<keyof typeof BUILDING_BLOCKS, readonly string[]>> = {
  procedure: ["baustein verwaltungsablauf", "ablauf", "prozess", "procedure", "workflow", "antrag"],
  network: ["baustein netzwerk", "network", "router", "switch", "topologie"],
  er: ["baustein er-skizze", "entity", "datenbank", "database", "beziehungen"],
};

function diagramCommands({ editor, centre, openText }: PaletteContext): Command[] {
  const blocks = (Object.keys(BUILDING_BLOCKS) as (keyof typeof BUILDING_BLOCKS)[]).map((block) => ({
    id: `block.${block}`,
    label: text(`palette.block.${block}`),
    words: BLOCK_WORDS[block],
    run: () => {
      placeDiagram(editor, BUILDING_BLOCKS[block], centre());
    },
  }));
  const uml: Command = {
    id: "block.uml",
    label: text("palette.block.uml"),
    words: ["baustein uml-klasse", "uml", "klasse", "class", "klassendiagramm"],
    run: () => {
      placeTable(editor, [["Kunde"], ["- name: String\n- id: int"], ["+ bestellen(): void"]], centre());
    },
  };
  const fromText: Command = {
    id: "insert.diagram",
    label: text("palette.diagram"),
    words: ["diagramm aus text", "flussdiagramm", "flowchart", "mermaid", "diagram"],
    run: () => {
      openText(diagramRequest(editor, centre, DIAGRAM_STARTER));
    },
  };
  return [fromText, ...blocks, uml];
}

export function paletteCommands(context: PaletteContext): Command[] {
  return [
    ...toolCommands(context),
    tableCommand(context),
    ...graphCommands(context),
    ...diagramCommands(context),
    ...templateCommands(context),
  ];
}
