export function insertMathToken(value: string, start: number, end: number, token: string) {
  const safeStart = Math.max(0, Math.min(start, value.length));
  const safeEnd = Math.max(safeStart, Math.min(end, value.length));
  const nextValue = `${value.slice(0, safeStart)}${token}${value.slice(safeEnd)}`;
  return { value: nextValue, caret: safeStart + token.length };
}

export const mathKeyTokens = [
  { token: "()/()", label: "a/b" },
  { token: "^", label: "xⁿ" },
  { token: "√()", label: "√" },
  { token: "π", label: "π" },
  { token: "≤", label: "≤" },
  { token: "≥", label: "≥" },
  { token: "±", label: "±" },
  { token: "(", label: "(" },
  { token: ")", label: ")" },
  { token: "=", label: "=" },
];
