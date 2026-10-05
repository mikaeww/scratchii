// Reads Mermaid-style flowchart text into nodes and edges. The supported subset is listed in
// docs/verification/study-tools/diagrams.md; anything else is refused with its line. Not here: layout or items.

export type Direction = "TD" | "BT" | "LR" | "RL";
export type NodeShape = "box" | "round" | "circle" | "decision";

export interface FlowNode {
  readonly id: string;
  readonly label: string;
  readonly shape: NodeShape;
}

export interface FlowEdge {
  readonly from: string;
  readonly to: string;
  readonly label: string;
  readonly arrow: boolean;
}

export interface Flowchart {
  readonly direction: Direction;
  readonly nodes: readonly FlowNode[];
  readonly edges: readonly FlowEdge[];
}

export class DiagramError extends Error {
  readonly line: number;
  constructor(line: number, problem: string) {
    super(`line ${line}: ${problem}`);
    this.name = "DiagramError";
    this.line = line;
  }
}

const HEADER = /^(?:flowchart|graph)(?:\s+(TD|TB|BT|LR|RL))?\s*$/i;
const UNSUPPORTED = /^(subgraph|end|classDef|class|style|linkStyle|click|direction)\b/;
const ID = /^[\p{L}\p{N}_]+/u;
// Longest openers first, so "((" is not read as "(".
const SHAPES: readonly (readonly [open: string, close: string, shape: NodeShape])[] = [
  ["([", "])", "round"],
  ["((", "))", "circle"],
  ["[[", "]]", "box"],
  ["[", "]", "box"],
  ["(", ")", "round"],
  ["{", "}", "decision"],
];
const EDGES: readonly (readonly [token: string, arrow: boolean])[] = [
  ["-.->", true],
  ["-->", true],
  ["==>", true],
  ["-.-", false],
  ["---", false],
  ["===", false],
];
// "-- label -->" and its line and thick forms.
const LABELLED = /^(--|==|-\.)\s+(.+?)\s+(-->|==>|\.->|---|===|\.-)/;

type Read<T> = readonly [value: T, rest: string];

function readLabel(text: string, close: string, line: number): Read<string> {
  if (text.startsWith('"')) {
    const end = text.indexOf('"', 1);
    if (end < 0 || !text.slice(end + 1).startsWith(close))
      throw new DiagramError(line, `missing " or ${close}`);
    return [text.slice(1, end), text.slice(end + 1 + close.length)];
  }
  const end = text.indexOf(close);
  if (end < 0) throw new DiagramError(line, `missing ${close}`);
  return [text.slice(0, end), text.slice(end + close.length)];
}

function readNode(text: string, line: number): Read<{ id: string; label?: string; shape?: NodeShape }> {
  const id = ID.exec(text.trimStart())?.[0];
  if (id === undefined) throw new DiagramError(line, `expected a node name at "${text.trim().slice(0, 20)}"`);
  const rest = text.trimStart().slice(id.length);
  const shape = SHAPES.find(([open]) => rest.startsWith(open));
  if (shape === undefined) return [{ id }, rest];
  const [open, close, kind] = shape;
  const [label, after] = readLabel(rest.slice(open.length), close, line);
  return [{ id, label: label.trim().replace(/<br\s*\/?>/gi, "\n"), shape: kind }, after];
}

function readEdge(text: string, line: number): Read<{ label: string; arrow: boolean }> | null {
  const trimmed = text.trimStart();
  if (trimmed === "") return null;
  // Plain edges first: "--- B --> C" must not read as an edge labelled "- B".
  const edge = EDGES.find(([token]) => trimmed.startsWith(token));
  const labelled = edge === undefined ? LABELLED.exec(trimmed) : null;
  if (labelled !== null) {
    const [whole, , label = "", end = ""] = labelled;
    return [{ label, arrow: end.endsWith(">") }, trimmed.slice(whole.length)];
  }
  if (edge === undefined)
    throw new DiagramError(line, `expected an edge like --> at "${trimmed.slice(0, 20)}"`);
  const after = trimmed.slice(edge[0].length);
  const piped = /^\s*\|([^|]*)\|/.exec(after);
  return piped === null
    ? [{ label: "", arrow: edge[1] }, after]
    : [{ label: (piped[1] ?? "").trim(), arrow: edge[1] }, after.slice(piped[0].length)];
}

class Builder {
  readonly nodes = new Map<string, FlowNode>();
  readonly edges: FlowEdge[] = [];

  node(found: { id: string; label?: string; shape?: NodeShape }): string {
    const known = this.nodes.get(found.id);
    // A later mention with a text or shape fills in what a bare mention left open.
    if (known === undefined || found.label !== undefined) {
      this.nodes.set(found.id, {
        id: found.id,
        label: found.label ?? known?.label ?? found.id,
        shape: found.shape ?? known?.shape ?? "box",
      });
    }
    return found.id;
  }

  statement(text: string, line: number): void {
    if (text.includes("&")) throw new DiagramError(line, '"&" is not supported; write one edge per pair');
    const [first, rest] = readNode(text, line);
    let from = this.node(first);
    let remaining = rest;
    for (let edge = readEdge(remaining, line); edge !== null; edge = readEdge(remaining, line)) {
      const [{ label, arrow }, afterEdge] = edge;
      if (afterEdge.trim() === "") throw new DiagramError(line, "an edge needs a node after it");
      const [target, afterNode] = readNode(afterEdge, line);
      const to = this.node(target);
      this.edges.push({ from, to, label, arrow });
      from = to;
      remaining = afterNode;
    }
  }
}

function direction(header: RegExpExecArray): Direction {
  const value = (header[1] ?? "TD").toUpperCase();
  return value === "TB" ? "TD" : (value as Direction);
}

export function readFlowchart(text: string): Flowchart {
  const builder = new Builder();
  let chosen: Direction = "TD";
  let first = true;
  text.split("\n").forEach((raw, index) => {
    const line = index + 1;
    const content = raw.replace(/%%.*$/, "").trim();
    if (content === "") return;
    const header = HEADER.exec(content);
    if (first && header !== null) {
      chosen = direction(header);
    } else if (UNSUPPORTED.test(content) || header !== null) {
      throw new DiagramError(line, `"${content.split(/\s/)[0] ?? ""}" is not supported`);
    } else {
      for (const part of content.split(";")) if (part.trim() !== "") builder.statement(part, line);
    }
    first = false;
  });
  if (builder.nodes.size === 0) throw new DiagramError(1, "no nodes");
  return { direction: chosen, nodes: [...builder.nodes.values()], edges: builder.edges };
}
