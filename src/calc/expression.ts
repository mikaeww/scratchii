// Reads and evaluates school maths: numbers (also 0x, 0b, 0o and a decimal comma), x, + - * / % ^, factorial,
// implicit multiplication and the usual functions. Not here: what a line ending in "=" means (answer.ts).

export type Node =
  | { readonly kind: "number"; readonly value: number }
  | { readonly kind: "x" }
  | { readonly kind: "negate"; readonly arg: Node }
  | { readonly kind: "factorial"; readonly arg: Node }
  | { readonly kind: "binary"; readonly op: BinaryOp; readonly left: Node; readonly right: Node }
  | { readonly kind: "call"; readonly name: FunctionName; readonly arg: Node };

export type BinaryOp = "+" | "-" | "*" | "/" | "%" | "^";

export class ExpressionError extends Error {
  readonly offset: number;
  constructor(problem: string, offset: number) {
    super(`${problem} at character ${offset + 1}`);
    this.name = "ExpressionError";
    this.offset = offset;
  }
}

const FUNCTIONS = {
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  asin: Math.asin,
  acos: Math.acos,
  atan: Math.atan,
  sinh: Math.sinh,
  cosh: Math.cosh,
  tanh: Math.tanh,
  sqrt: Math.sqrt,
  cbrt: Math.cbrt,
  abs: Math.abs,
  ln: Math.log,
  log: Math.log10,
  lg: Math.log10,
  log2: Math.log2,
  exp: Math.exp,
  floor: Math.floor,
  ceil: Math.ceil,
  round: Math.round,
  sign: Math.sign,
} as const;

export type FunctionName = keyof typeof FUNCTIONS;
export const FUNCTION_NAMES = Object.keys(FUNCTIONS) as FunctionName[];

const CONSTANTS: Readonly<Record<string, number>> = { pi: Math.PI, π: Math.PI, e: Math.E, tau: 2 * Math.PI };

type Token =
  | { readonly kind: "number"; readonly value: number; readonly at: number }
  | { readonly kind: "name"; readonly name: string; readonly at: number }
  | { readonly kind: "symbol"; readonly symbol: string; readonly at: number };

const ALIASES: Readonly<Record<string, string>> = { "×": "*", "·": "*", "÷": "/", "−": "-", ":": "/" };
const RADIX: Readonly<Record<string, number>> = { x: 16, b: 2, o: 8 };
const DIGITS: Readonly<Record<number, RegExp>> = { 16: /^[0-9a-f]+$/i, 2: /^[01]+$/, 8: /^[0-7]+$/ };

function numberAt(source: string, at: number): [Token, number] {
  const prefixed = /^0([xbo])([0-9a-f]+)/i.exec(source.slice(at));
  if (prefixed !== null) {
    const [whole, letter = "", digits = ""] = prefixed;
    const radix = RADIX[letter.toLowerCase()] ?? 10;
    const value = Number.parseInt(digits, radix);
    if (DIGITS[radix]?.test(digits) !== true)
      throw new ExpressionError(`"${whole}" is not a base-${radix} number`, at);
    return [{ kind: "number", value, at }, at + whole.length];
  }
  const match = /^\d*(?:[.,]\d+)?/.exec(source.slice(at))?.[0] ?? "";
  if (match === "" || match === "." || match === ",") throw new ExpressionError("expected a number", at);
  return [{ kind: "number", value: Number(match.replace(",", ".")), at }, at + match.length];
}

// Letters run together ("sinx", "2pix") are split into known names, longest first.
function namesAt(word: string, at: number): Token[] {
  const known = [...FUNCTION_NAMES, ...Object.keys(CONSTANTS), "x"].sort((a, b) => b.length - a.length);
  const tokens: Token[] = [];
  let rest = word;
  while (rest !== "") {
    const name = known.find((k) => rest.toLowerCase().startsWith(k));
    if (name === undefined)
      throw new ExpressionError(`unknown name "${rest}"`, at + word.length - rest.length);
    tokens.push({ kind: "name", name, at: at + word.length - rest.length });
    rest = rest.slice(name.length);
  }
  return tokens;
}

export function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let at = 0;
  while (at < source.length) {
    const char = source[at] ?? "";
    if (/\s/.test(char)) {
      at++;
    } else if (/[\d.,]/.test(char)) {
      const [token, next] = numberAt(source, at);
      tokens.push(token);
      at = next;
    } else if (/[a-zπ]/i.test(char)) {
      const word = /^(?:log2|[a-zπ]+)/i.exec(source.slice(at))?.[0] ?? char;
      tokens.push(...namesAt(word, at));
      at += word.length;
    } else if (char === "²" || char === "³") {
      tokens.push({ kind: "symbol", symbol: "^", at }, { kind: "number", value: char === "²" ? 2 : 3, at });
      at++;
    } else if ("+-*/%^()!".includes(char) || char in ALIASES) {
      tokens.push({ kind: "symbol", symbol: ALIASES[char] ?? char, at });
      at++;
    } else {
      throw new ExpressionError(`unexpected "${char}"`, at);
    }
  }
  return tokens;
}

class Parser {
  private index = 0;
  private readonly tokens: readonly Token[];
  private readonly length: number;
  constructor(tokens: readonly Token[], length: number) {
    this.tokens = tokens;
    this.length = length;
  }

  private peek(): Token | undefined {
    return this.tokens[this.index];
  }

  private isSymbol(symbol: string): boolean {
    const token = this.peek();
    return token?.kind === "symbol" && token.symbol === symbol;
  }

  private where(): number {
    return this.peek()?.at ?? this.length;
  }

  parse(): Node {
    if (this.tokens.length === 0) throw new ExpressionError("nothing to calculate", 0);
    const node = this.sum();
    if (this.peek() !== undefined) throw new ExpressionError("unexpected input", this.where());
    return node;
  }

  private sum(): Node {
    let node = this.product();
    while (this.isSymbol("+") || this.isSymbol("-")) {
      const op = this.isSymbol("+") ? "+" : "-";
      this.index++;
      node = { kind: "binary", op, left: node, right: this.product() };
    }
    return node;
  }

  // Implicit multiplication: a name or an opening bracket right after an operand multiplies ("2x", "3(x+1)").
  private product(): Node {
    let node = this.unary();
    for (;;) {
      const token = this.peek();
      if (
        token?.kind === "symbol" &&
        (token.symbol === "*" || token.symbol === "/" || token.symbol === "%")
      ) {
        this.index++;
        node = { kind: "binary", op: token.symbol, left: node, right: this.unary() };
      } else if (token?.kind === "name" || this.isSymbol("(")) {
        node = { kind: "binary", op: "*", left: node, right: this.power() };
      } else {
        return node;
      }
    }
  }

  private unary(): Node {
    if (this.isSymbol("-")) {
      this.index++;
      return { kind: "negate", arg: this.unary() };
    }
    if (this.isSymbol("+")) {
      this.index++;
      return this.unary();
    }
    return this.power();
  }

  // Right-associative and tighter than unary minus: -2^2 is -4, 2^3^2 is 2^9, 2^-1 is 0.5.
  private power(): Node {
    const base = this.postfix();
    if (!this.isSymbol("^")) return base;
    this.index++;
    return { kind: "binary", op: "^", left: base, right: this.unary() };
  }

  private postfix(): Node {
    let node = this.primary();
    while (this.isSymbol("!")) {
      this.index++;
      node = { kind: "factorial", arg: node };
    }
    return node;
  }

  private primary(): Node {
    const token = this.peek();
    if (token === undefined) throw new ExpressionError("expected a number", this.length);
    this.index++;
    if (token.kind === "number") return { kind: "number", value: token.value };
    if (token.kind === "symbol") {
      if (token.symbol !== "(") throw new ExpressionError(`unexpected "${token.symbol}"`, token.at);
      const inner = this.sum();
      if (!this.isSymbol(")")) throw new ExpressionError("missing )", this.where());
      this.index++;
      return inner;
    }
    if (token.name === "x") return { kind: "x" };
    const constant = CONSTANTS[token.name];
    if (constant !== undefined) return { kind: "number", value: constant };
    // With brackets the function binds first, ln(x)^2 is (ln x)^2; without, it takes the next operand with its
    // powers, sin x^2 is sin(x^2).
    const arg = this.isSymbol("(") ? this.primary() : this.power();
    return { kind: "call", name: token.name as FunctionName, arg };
  }
}

export function parseExpression(source: string): Node {
  return new Parser(tokenize(source), source.length).parse();
}

function factorial(n: number): number {
  if (!Number.isInteger(n) || n < 0) return NaN;
  let result = 1;
  for (let k = 2; k <= n && result !== Infinity; k++) result *= k;
  return result;
}

function apply(op: BinaryOp, a: number, b: number): number {
  switch (op) {
    case "+":
      return a + b;
    case "-":
      return a - b;
    case "*":
      return a * b;
    case "/":
      return a / b;
    case "%":
      return a % b;
    case "^":
      return a ** b;
  }
}

export function evaluate(node: Node, x = NaN): number {
  switch (node.kind) {
    case "number":
      return node.value;
    case "x":
      return x;
    case "negate":
      return -evaluate(node.arg, x);
    case "factorial":
      return factorial(evaluate(node.arg, x));
    case "binary":
      return apply(node.op, evaluate(node.left, x), evaluate(node.right, x));
    case "call":
      return FUNCTIONS[node.name](evaluate(node.arg, x));
  }
}

export function usesX(node: Node): boolean {
  switch (node.kind) {
    case "x":
      return true;
    case "number":
      return false;
    case "binary":
      return usesX(node.left) || usesX(node.right);
    default:
      return usesX(node.arg);
  }
}
