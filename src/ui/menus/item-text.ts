// Graphs and charts are edited as plain text: their functions and range, or their labelled values. Builds the
// dialog request for an item and writes the result back in one undo step.
import type { Editor } from "../../editor/editor.ts";
import type { Vec } from "../../editor/viewport.ts";
import { itemAt } from "../../geometry/hit.ts";
import { PlotTextError, chartText, graphText, readChart, readGraph } from "../../calc/plot.ts";
import { reviseItem, type ChartItem, type GraphItem } from "../../model/item.ts";
import { text } from "../text.ts";
import type { TextRequest } from "./text-dialog.ts";

const REACH = 6;

// The item as it is now: it may have been placed, moved or synced since the dialog opened.
function latest<T extends GraphItem | ChartItem>(editor: Editor, item: T): T {
  const now = editor.board.items.find((other) => other.id === item.id);
  return now?.type === item.type ? (now as T) : item;
}

function problem(error: unknown): string {
  if (error instanceof PlotTextError) return `${text("dialog.problem")} ${error.message}`;
  throw error;
}

export function graphRequest(editor: Editor, item: GraphItem): TextRequest {
  return {
    title: "graph.title",
    hint: "graph.hint",
    value: graphText(item.functions, item.range),
    apply: (value) => {
      try {
        const { functions, range } = readGraph(value, item.range);
        editor.commit([reviseItem({ ...latest(editor, item), functions, range })]);
        return null;
      } catch (error) {
        return problem(error);
      }
    },
  };
}

export function chartRequest(editor: Editor, item: ChartItem): TextRequest {
  return {
    title: "chart.title",
    hint: "chart.hint",
    value: chartText(item.labels, item.values),
    apply: (value) => {
      try {
        editor.commit([reviseItem({ ...latest(editor, item), ...readChart(value) })]);
        return null;
      } catch (error) {
        return problem(error);
      }
    },
  };
}

export function editAsText(editor: Editor, open: (request: TextRequest) => void, world: Vec): boolean {
  const hit = itemAt(editor.scene(), world, REACH / editor.view.zoom);
  if (hit?.type === "graph") open(graphRequest(editor, hit));
  else if (hit?.type === "chart") open(chartRequest(editor, hit));
  else return false;
  return true;
}
