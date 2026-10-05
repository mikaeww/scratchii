import assert from "node:assert/strict";
import { test } from "node:test";
import { answerFor } from "../src/calc/answer.ts";
import {
  ExpressionError,
  FUNCTION_NAMES,
  evaluate,
  parseExpression,
  type BinaryOp,
  type Node,
} from "../src/calc/expression.ts";
import { readSubnet } from "../src/calc/subnet.ts";
import { between, pick, seeded, type Random } from "./random.ts";

const OPS: readonly BinaryOp[] = ["+", "-", "*", "/", "%", "^"];

function randomTree(random: Random, depth: number): Node {
  const leaf = depth === 0 || random() < 0.25;
  if (leaf) {
    return random() < 0.3
      ? { kind: "x" }
      : { kind: "number", value: Math.round(between(random, 0, 50) * 100) / 100 };
  }
  const roll = random();
  if (roll < 0.1) return { kind: "negate", arg: randomTree(random, depth - 1) };
  if (roll < 0.15)
    return { kind: "factorial", arg: { kind: "number", value: Math.floor(between(random, 0, 8)) } };
  if (roll < 0.35)
    return { kind: "call", name: pick(random, FUNCTION_NAMES), arg: randomTree(random, depth - 1) };
  return {
    kind: "binary",
    op: pick(random, OPS),
    left: randomTree(random, depth - 1),
    right: randomTree(random, depth - 1),
  };
}

function printed(node: Node): string {
  switch (node.kind) {
    case "number":
      return String(node.value);
    case "x":
      return "x";
    case "negate":
      return `(-${printed(node.arg)})`;
    case "factorial":
      return `(${printed(node.arg)})!`;
    case "binary":
      return `(${printed(node.left)} ${node.op} ${printed(node.right)})`;
    case "call":
      return `${node.name}(${printed(node.arg)})`;
  }
}

function same(a: number, b: number): boolean {
  if (Number.isNaN(a) || Number.isNaN(b)) return Number.isNaN(a) && Number.isNaN(b);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return a === b;
  return Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
}

test("C1: printing a tree and parsing it back evaluates the same", () => {
  const random = seeded(40);
  for (let i = 0; i < 5000; i++) {
    const tree = randomTree(random, 5);
    const x = between(random, -10, 10);
    const source = printed(tree);
    assert.ok(same(evaluate(parseExpression(source), x), evaluate(tree, x)), `case ${i}: ${source}`);
  }
});

test("C2: precedence, associativity and implicit multiplication", () => {
  const cases: [string, number][] = [
    ["2 + 3 * 4", 14],
    ["-2^2", -4],
    ["2^3^2", 512],
    ["2^-1", 0.5],
    ["(1 + 2)(3 + 4)", 21],
    ["2pi", 2 * Math.PI],
    ["3(2 + 1)", 9],
    ["sin x^2", Math.sin(4)],
    ["ln(e)^2", 1],
    ["sin(x)^2", Math.sin(2) ** 2],
    ["sin(x)!", Number.NaN],
    ["2x + 1", 5],
    ["10 % 4", 2],
    ["5!", 120],
    ["3,5 * 2", 7],
    ["4²", 16],
    ["8 : 2 × 3", 12],
    ["log 1000", 3],
    ["ln e", 1],
  ];
  for (const [source, expected] of cases)
    assert.ok(same(evaluate(parseExpression(source), 2), expected), source);
});

test("C3: malformed input fails with an ExpressionError naming the place, never anything else", () => {
  for (const [source, offset] of [
    ["2 +", 3],
    ["(1 + 2", 6],
    ["foo(2)", 0],
    ["2 $ 3", 2],
    ["", 0],
    ["0b102", 0],
  ] as const) {
    assert.throws(
      () => parseExpression(source),
      (error: unknown) => error instanceof ExpressionError && error.offset === offset,
      source,
    );
  }
  const random = seeded(41);
  const alphabet = [...Array.from("0123456789+-*/^%()!.,x πe"), "sin", "sqrt", "0x", "ln"];
  for (let i = 0; i < 2000; i++) {
    const source = Array.from({ length: Math.floor(between(random, 0, 12)) }, () =>
      pick(random, alphabet),
    ).join("");
    try {
      parseExpression(source);
    } catch (error) {
      assert.ok(error instanceof ExpressionError, `case ${i}: ${source}`);
    }
  }
});

test("C4: base literals and conversions round-trip every integer up to 65535", () => {
  for (let n = 0; n <= 65535; n++) {
    assert.equal(evaluate(parseExpression(`0x${n.toString(16)}`)), n);
    assert.equal(evaluate(parseExpression(`0b${n.toString(2)}`)), n);
    assert.equal(evaluate(parseExpression(`0o${n.toString(8)}`)), n);
    assert.deepEqual(answerFor(`${n} in hex =`), {
      kind: "value",
      text: `0x${n.toString(16).toUpperCase()}`,
    });
  }
  assert.deepEqual(answerFor("0b1011 in dec ="), { kind: "value", text: "11" });
  assert.deepEqual(answerFor("rent 450 + 120 ="), { kind: "value", text: "570" });
  assert.equal(answerFor("page 3 ="), null);
  assert.equal(answerFor("A = B"), null);
});

test("C5: subnets match bit arithmetic for every prefix", () => {
  const random = seeded(42);
  const dotted = (n: number): string => [n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join(".");
  for (let prefix = 0; prefix <= 32; prefix++) {
    for (let i = 0; i < 2000; i++) {
      const address = Math.floor(random() * 2 ** 32);
      const size = 2 ** (32 - prefix);
      const network = Math.floor(address / size) * size;
      const subnet = readSubnet(`${dotted(address)}/${prefix}`);
      assert.ok(subnet !== null);
      assert.equal(subnet.network, dotted(network));
      assert.equal(subnet.broadcast, dotted(network + size - 1));
      assert.equal(subnet.mask, dotted(2 ** 32 - size));
      assert.equal(subnet.hosts, Math.max(0, size - 2));
    }
  }
  assert.equal(readSubnet("300.1.1.1/24"), null);
  assert.equal(readSubnet("10.0.0.0/33"), null);
});
