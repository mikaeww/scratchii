// Turns a laid-out flowchart into board items: a labelled box, ellipse or diamond per node and an attached line
// or arrow per edge (ADR 0007). The editor reroutes the edges onto the node outlines when they are committed.
import { PRESET_CORNERS } from "../geometry/polygon.ts";
import {
  createItem,
  type Color,
  type Item,
  type LineItem,
  type PolygonItem,
  type ShapeItem,
  type Size as ItemSize,
} from "../model/item.ts";
import type { Flowchart, FlowNode } from "./flowchart.ts";
import { layoutFlowchart, type Size } from "./layout.ts";

export interface DiagramStyle {
  readonly color: Color;
  readonly fill: Color | null;
  readonly size: ItemSize;
}

function nodeItem(
  node: FlowNode,
  box: { x: number; y: number; width: number; height: number },
  style: DiagramStyle,
): Item {
  const common = { ...box, ...style, label: node.label };
  if (node.shape === "decision") {
    return createItem<PolygonItem>({ ...common, type: "polygon", corners: PRESET_CORNERS.diamond });
  }
  return createItem<ShapeItem>({ ...common, type: node.shape === "box" ? "rect" : "ellipse" });
}

export function buildDiagram(
  chart: Flowchart,
  sizeOf: (node: FlowNode) => Size,
  style: DiagramStyle,
): Item[] {
  const sizes = new Map(chart.nodes.map((node) => [node.id, sizeOf(node)]));
  const boxes = layoutFlowchart(chart, sizes);
  const nodes = new Map(
    chart.nodes.map((node) => [
      node.id,
      nodeItem(node, boxes.get(node.id) ?? { x: 0, y: 0, ...sizeOf(node) }, style),
    ]),
  );
  const centre = (id: string): [number, number] => {
    const box = boxes.get(id);
    return box === undefined ? [0, 0] : [box.x + box.width / 2, box.y + box.height / 2];
  };
  const edges = chart.edges.map((edge) => {
    const [from, to] = [centre(edge.from), centre(edge.to)];
    return createItem<LineItem>({
      type: edge.arrow ? "arrow" : "line",
      x: from[0],
      y: from[1],
      color: style.color,
      size: style.size,
      points: [
        [0, 0],
        [to[0] - from[0], to[1] - from[1]],
      ],
      label: edge.label,
      ends: [nodes.get(edge.from)?.id ?? null, nodes.get(edge.to)?.id ?? null],
    });
  });
  return [...nodes.values(), ...edges];
}
