// What a line of text ending in "=" asks for: a number, a number in another base, or an IPv4 subnet. Not here:
// putting the answer into the text (src/ui/text-editor.ts) or wording the subnet (the interface text).
import { ExpressionError, evaluate, parseExpression, usesX } from "./expression.ts";
import { readSubnet, type Subnet } from "./subnet.ts";

export type Answer =
  { readonly kind: "value"; readonly text: string } | { readonly kind: "subnet"; readonly subnet: Subnet };

const BASES = { hex: 16, bin: 2, oct: 8, dec: 10 } as const;
const PREFIX: Readonly<Record<number, string>> = { 16: "0x", 2: "0b", 8: "0o", 10: "" };
const CONVERSION = /\s+(?:in|to|als)\s+(hex|bin|oct|dec)\s*$/i;
// Results are rounded to this many significant digits, so 0.1 + 0.2 shows 0.3.
const DIGITS = 12;

export function formatNumber(value: number, decimalComma: boolean): string {
  if (Number.isNaN(value)) return "?";
  if (!Number.isFinite(value)) return value > 0 ? "∞" : "-∞";
  const rounded = Number(value.toPrecision(DIGITS));
  const text =
    Math.abs(rounded) >= 1e15 || (rounded !== 0 && Math.abs(rounded) < 1e-9)
      ? rounded.toExponential()
      : String(rounded);
  return decimalComma ? text.replace(".", ",") : text;
}

function inBase(value: number, base: number): string {
  if (!Number.isSafeInteger(value)) throw new ExpressionError("only whole numbers convert", 0);
  const sign = value < 0 ? "-" : "";
  const digits = Math.abs(value).toString(base);
  return `${sign}${PREFIX[base] ?? ""}${base === 16 ? digits.toUpperCase() : digits}`;
}

function valueOf(source: string, conversion: RegExpExecArray | null): Answer | null {
  const tree = parseExpression(source);
  if (usesX(tree)) return null;
  // A lone number is no question ("page 3 ="), unless it is written in another base or to be converted.
  if (tree.kind === "number" && conversion === null && !/0[xbo]/i.test(source)) return null;
  const value = evaluate(tree);
  if (conversion !== null) {
    const base = BASES[(conversion[1] ?? "dec").toLowerCase() as keyof typeof BASES];
    return { kind: "value", text: inBase(value, base) };
  }
  return { kind: "value", text: formatNumber(value, /\d,\d/.test(source)) };
}

// The longest maths at the end of a line before its final "=", so "rent 450 + 120 =" works. Prose with an "="
// in it is ordinary text, so a line without maths has no answer rather than an error.
export function answerFor(line: string): Answer | null {
  const question = line.replace(/=\s*$/, "");
  if (question === line || question.trim() === "") return null;
  const starts = [0, ...[...question.matchAll(/[\s:]+/g)].map((m) => m.index + m[0].length)];
  for (const start of starts) {
    const part = question.slice(start);
    const subnet = readSubnet(part);
    if (subnet !== null) return { kind: "subnet", subnet };
    const conversion = CONVERSION.exec(part);
    try {
      const answer = valueOf(conversion === null ? part : part.slice(0, conversion.index), conversion);
      if (answer !== null) return answer;
    } catch (error) {
      if (!(error instanceof ExpressionError)) throw error;
    }
  }
  return null;
}
