/**
 * Safe math-expression evaluator for graphs driven by AI output (e.g. solver `plotFunction` events).
 *
 * Unlike `compileFunction` in lib/studio/functionPlot.ts (which uses `new Function`), this is a small
 * recursive-descent parser: it only understands numbers, `x`, + - * / ^, parentheses, implicit
 * multiplication (`2x`, `(x-1)(x+1)`, `2exp(x)`), the constants `e`, `pi`, and the functions below.
 * Anything else throws `SafeExpressionError` — nothing is ever executed as code.
 */
export class SafeExpressionError extends Error {}

type Node =
  | { kind: "num"; value: number }
  | { kind: "x" }
  | { kind: "neg"; arg: Node }
  | { kind: "bin"; op: "+" | "-" | "*" | "/" | "^"; left: Node; right: Node }
  | { kind: "call"; fn: FnName; arg: Node };

const FUNCTIONS = {
  exp: Math.exp,
  ln: Math.log,
  log: Math.log10,
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  sqrt: Math.sqrt,
  abs: Math.abs,
} as const;
type FnName = keyof typeof FUNCTIONS;

const CONSTANTS: Record<string, number> = { e: Math.E, pi: Math.PI };
const MAX_LENGTH = 200;
const MAX_DEPTH = 40;

type Token = { type: "num"; value: number } | { type: "id"; value: string } | { type: "op"; value: string };

function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  const text = source.replace(/\*\*/g, "^").replace(/π/g, "pi").replace(/·|×/g, "*").replace(/−/g, "-");
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (/\s/.test(ch)) {
      i += 1;
    } else if (/[0-9.]/.test(ch)) {
      const match = /^(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/i.exec(text.slice(i));
      if (!match) throw new SafeExpressionError(`Bad number at ${i}`);
      tokens.push({ type: "num", value: Number(match[0]) });
      i += match[0].length;
    } else if (/[a-z]/i.test(ch)) {
      const match = /^[a-z]+/i.exec(text.slice(i));
      const word = (match?.[0] ?? "").toLowerCase();
      tokens.push({ type: "id", value: word });
      i += word.length;
    } else if ("+-*/^()".includes(ch)) {
      tokens.push({ type: "op", value: ch });
      i += 1;
    } else {
      throw new SafeExpressionError(`Unexpected character "${ch}"`);
    }
  }
  return tokens;
}

/** Split identifiers like "xexp" or "2pix" into known names (x, e, pi, functions). */
function splitIdentifiers(tokens: Token[]): Token[] {
  const names = [...Object.keys(FUNCTIONS), "pi", "x", "e"].sort((a, b) => b.length - a.length);
  const out: Token[] = [];
  for (const token of tokens) {
    if (token.type !== "id") {
      out.push(token);
      continue;
    }
    let rest = token.value;
    while (rest.length > 0) {
      const name = names.find((candidate) => rest.startsWith(candidate));
      if (!name) throw new SafeExpressionError(`Unknown name "${token.value}"`);
      out.push({ type: "id", value: name });
      rest = rest.slice(name.length);
    }
  }
  return out;
}

class Parser {
  private index = 0;
  private depth = 0;
  private readonly tokens: Token[];
  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  parse(): Node {
    const node = this.expression();
    if (this.index < this.tokens.length) throw new SafeExpressionError("Unexpected trailing input");
    return node;
  }

  private peek(): Token | undefined {
    return this.tokens[this.index];
  }

  private isOp(value: string): boolean {
    const token = this.peek();
    return token?.type === "op" && token.value === value;
  }

  private enter() {
    this.depth += 1;
    if (this.depth > MAX_DEPTH) throw new SafeExpressionError("Expression too deep");
  }

  private expression(): Node {
    let left = this.term();
    while (this.isOp("+") || this.isOp("-")) {
      const op = (this.tokens[this.index++] as { value: "+" | "-" }).value;
      left = { kind: "bin", op, left, right: this.term() };
    }
    return left;
  }

  private term(): Node {
    let left = this.unary();
    for (;;) {
      if (this.isOp("*") || this.isOp("/")) {
        const op = (this.tokens[this.index++] as { value: "*" | "/" }).value;
        left = { kind: "bin", op, left, right: this.unary() };
      } else if (this.startsFactor()) {
        left = { kind: "bin", op: "*", left, right: this.power() };
      } else {
        return left;
      }
    }
  }

  private startsFactor(): boolean {
    const token = this.peek();
    return token !== undefined && (token.type === "num" || token.type === "id" || (token.type === "op" && token.value === "("));
  }

  private unary(): Node {
    if (this.isOp("-")) {
      this.index += 1;
      this.enter();
      const arg = this.unary();
      this.depth -= 1;
      return { kind: "neg", arg };
    }
    if (this.isOp("+")) {
      this.index += 1;
      return this.unary();
    }
    return this.power();
  }

  private power(): Node {
    const base = this.primary();
    if (this.isOp("^")) {
      this.index += 1;
      this.enter();
      const exponent = this.unary();
      this.depth -= 1;
      return { kind: "bin", op: "^", left: base, right: exponent };
    }
    return base;
  }

  private primary(): Node {
    const token = this.tokens[this.index++];
    if (!token) throw new SafeExpressionError("Unexpected end of expression");
    if (token.type === "num") return { kind: "num", value: token.value };
    if (token.type === "op" && token.value === "(") {
      this.enter();
      const inner = this.expression();
      this.depth -= 1;
      if (!this.isOp(")")) throw new SafeExpressionError("Missing )");
      this.index += 1;
      return inner;
    }
    if (token.type === "id") {
      if (token.value === "x") return { kind: "x" };
      if (token.value in CONSTANTS) return { kind: "num", value: CONSTANTS[token.value] };
      if (token.value in FUNCTIONS) {
        this.enter();
        const arg = this.isOp("(") ? this.primary() : this.power();
        this.depth -= 1;
        return { kind: "call", fn: token.value as FnName, arg };
      }
    }
    throw new SafeExpressionError(`Unexpected token "${token.value}"`);
  }
}

function evaluate(node: Node, x: number): number {
  switch (node.kind) {
    case "num":
      return node.value;
    case "x":
      return x;
    case "neg":
      return -evaluate(node.arg, x);
    case "call":
      return FUNCTIONS[node.fn](evaluate(node.arg, x));
    case "bin": {
      const a = evaluate(node.left, x);
      const b = evaluate(node.right, x);
      if (node.op === "+") return a + b;
      if (node.op === "-") return a - b;
      if (node.op === "*") return a * b;
      if (node.op === "/") return a / b;
      return a ** b;
    }
  }
}

/** Parse once, evaluate many times. Throws SafeExpressionError on anything outside the grammar. */
export function parseSafeExpression(source: string): (x: number) => number {
  if (source.length > MAX_LENGTH) throw new SafeExpressionError("Expression too long");
  const tree = new Parser(splitIdentifiers(tokenize(source))).parse();
  return (x: number) => evaluate(tree, x);
}

export type GraphPoint = { x: number; y: number };

/** Evenly sampled points on [from, to]; non-finite values are dropped (graph gaps). Returns null if unparsable. */
export function sampleExpression(source: string, from: number, to: number, count = 96): GraphPoint[] | null {
  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) return null;
  let fn: (x: number) => number;
  try {
    fn = parseSafeExpression(source);
  } catch {
    return null;
  }
  const points: GraphPoint[] = [];
  const steps = Math.max(8, Math.min(400, Math.floor(count)));
  for (let i = 0; i <= steps; i += 1) {
    const x = from + ((to - from) * i) / steps;
    const y = fn(x);
    if (Number.isFinite(y)) points.push({ x, y });
  }
  return points.length >= 2 ? points : null;
}
