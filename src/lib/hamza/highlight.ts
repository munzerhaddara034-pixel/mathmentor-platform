/** Tiny, dependency-free syntax highlighter for diff lines (TS/TSX/JS/CSS/JSON/MD), one line at a time. */

export type TokenKind = "kw" | "str" | "com" | "num" | "plain";
export type Token = { kind: TokenKind; text: string };

const KEYWORDS = new Set(
  "import export from const let var function return if else for while do switch case break continue new class extends interface type enum as async await try catch finally throw default typeof instanceof in of null undefined true false void this super yield".split(
    " ",
  ),
);

const TOKEN_RE = /(\/\/.*$|\/\*.*?\*\/|#.*$)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_$][\w$]*)/g;

export function highlightLine(line: string, path = ""): Token[] {
  const markdown = /\.(md|txt)$/i.test(path);
  if (markdown || line.length > 400) return [{ kind: "plain", text: line }];
  const css = /\.css$/i.test(path);
  const tokens: Token[] = [];
  let last = 0;
  for (const match of line.matchAll(TOKEN_RE)) {
    const index = match.index ?? 0;
    if (index > last) tokens.push({ kind: "plain", text: line.slice(last, index) });
    const [text, comment, string, number, word] = match;
    if (comment && (!css || !comment.startsWith("#") || /^#\s/.test(comment))) tokens.push({ kind: "com", text });
    else if (comment) tokens.push({ kind: "plain", text });
    else if (string) tokens.push({ kind: "str", text });
    else if (number) tokens.push({ kind: "num", text });
    else if (word && !css && KEYWORDS.has(word)) tokens.push({ kind: "kw", text });
    else tokens.push({ kind: "plain", text });
    last = index + text.length;
  }
  if (last < line.length) tokens.push({ kind: "plain", text: line.slice(last) });
  return tokens;
}
