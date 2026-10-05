// Places the nodes of a flowchart in layers: each node one layer after its furthest predecessor (cycles broken
// where a depth-first walk meets a node still open), the order within a layer settled by two barycenter
// sweeps, layers stacked in the chosen direction. Pure; node sizes come from the caller.
import type { Box } from "../geometry/box.ts";
import type { Direction, Flowchart } from "./flowchart.ts";

export interface Size {
  readonly width: number;
  readonly height: number;
}

// World units between nodes in a layer and between layers.
export const NODE_GAP = 60;
export const LAYER_GAP = 90;

function forwardEdges(chart: Flowchart): [string, string][] {
  const outgoing = new Map(chart.nodes.map((node) => [node.id, [] as string[]]));
  for (const edge of chart.edges) outgoing.get(edge.from)?.push(edge.to);
  const state = new Map<string, "open" | "done">();
  const kept: [string, string][] = [];
  const walk = (id: string): void => {
    state.set(id, "open");
    for (const next of outgoing.get(id) ?? []) {
      // An edge back to a node still open closes a cycle; it does not count for the layers.
      if (state.get(next) === "open" || next === id) continue;
      kept.push([id, next]);
      if (!state.has(next)) walk(next);
    }
    state.set(id, "done");
  };
  for (const node of chart.nodes) if (!state.has(node.id)) walk(node.id);
  return kept;
}

function layersOf(chart: Flowchart): string[][] {
  const edges = forwardEdges(chart);
  const layer = new Map(chart.nodes.map((node) => [node.id, 0]));
  // Longest path on the acyclic part: relax as often as there are nodes.
  for (let round = 0; round < chart.nodes.length; round++) {
    let changed = false;
    for (const [from, to] of edges) {
      const next = (layer.get(from) ?? 0) + 1;
      if (next > (layer.get(to) ?? 0)) {
        layer.set(to, next);
        changed = true;
      }
    }
    if (!changed) break;
  }
  const layers: string[][] = [];
  for (const node of chart.nodes) (layers[layer.get(node.id) ?? 0] ??= []).push(node.id);
  return layers.filter((ids) => ids.length > 0);
}

function sweep(layers: string[][], neighbours: Map<string, string[]>, reverse: boolean): void {
  const order = reverse ? [...layers.keys()].reverse() : [...layers.keys()];
  for (const index of order.slice(1)) {
    const reference = layers[index + (reverse ? 1 : -1)] ?? [];
    const position = new Map(reference.map((id, i) => [id, i]));
    const centre = (id: string): number => {
      const linked = (neighbours.get(id) ?? []).filter((n) => position.has(n));
      return linked.length === 0
        ? Infinity
        : linked.reduce((sum, n) => sum + (position.get(n) ?? 0), 0) / linked.length;
    };
    const layer = layers[index] ?? [];
    const keyed = layer.map((id, i) => ({ id, key: centre(id), i }));
    // Nodes without neighbours in the reference layer keep their place relative to each other at the end.
    keyed.sort((a, b) => (a.key === b.key ? a.i - b.i : a.key - b.key));
    layers[index] = keyed.map((entry) => entry.id);
  }
}

function place(layers: string[][], sizes: ReadonlyMap<string, Size>, direction: Direction): Map<string, Box> {
  const across = direction === "TD" || direction === "BT" ? "width" : "height";
  const along = across === "width" ? "height" : "width";
  const boxes = new Map<string, Box>();
  let depth = 0;
  for (const layer of layers) {
    const thickness = Math.max(...layer.map((id) => sizes.get(id)?.[along] ?? 0));
    const span =
      layer.reduce((sum, id) => sum + (sizes.get(id)?.[across] ?? 0), 0) + NODE_GAP * (layer.length - 1);
    let offset = -span / 2;
    for (const id of layer) {
      const size = sizes.get(id) ?? { width: 0, height: 0 };
      const a = offset;
      const d = depth + (thickness - size[along]) / 2;
      boxes.set(id, across === "width" ? { x: a, y: d, ...size } : { x: d, y: a, ...size });
      offset += size[across] + NODE_GAP;
    }
    depth += thickness + LAYER_GAP;
  }
  if (direction === "BT" || direction === "RL") {
    for (const [id, box] of boxes)
      boxes.set(
        id,
        direction === "BT" ? { ...box, y: -box.y - box.height } : { ...box, x: -box.x - box.width },
      );
  }
  return boxes;
}

export function layoutFlowchart(chart: Flowchart, sizes: ReadonlyMap<string, Size>): Map<string, Box> {
  const layers = layersOf(chart);
  const neighbours = new Map(chart.nodes.map((node) => [node.id, [] as string[]]));
  for (const edge of chart.edges) {
    neighbours.get(edge.from)?.push(edge.to);
    neighbours.get(edge.to)?.push(edge.from);
  }
  sweep(layers, neighbours, false);
  sweep(layers, neighbours, true);
  return place(layers, sizes, chart.direction);
}
