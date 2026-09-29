/**
 * Deterministic guards on every agent reply (docs/TEAM_CHAT_SPEC.md §0.2):
 * fixed phone numbers, forbidden brand, and a Barème quarter-mark check for محمد.
 */

export const WHISH_NUMBER = "96170772968";
export const WHATSAPP_COMMANDS_NUMBER = "96176532421";

/** Normalises shortened/spaced variants of the two official numbers and removes the forbidden brand. */
export function enforceConstants(text: string): string {
  return text
    .replace(/(?<![\d])(?:\+\s?)?(?:961[\s-]?)?70[\s-]?772[\s-]?968(?![\d])/g, WHISH_NUMBER)
    .replace(/(?<![\d])(?:\+\s?)?(?:961[\s-]?)?76[\s-]?532[\s-]?421(?![\d])/g, WHATSAPP_COMMANDS_NUMBER)
    .replace(/الطارة/g, "أي علامة أخرى");
}

/** Marks in a Barème must be multiples of 0.25. Returns offending values found after a Barème heading. */
export function baremeQuarterIssues(text: string): string[] {
  const index = text.search(/bar[eè]me|mark scheme|سلّم التصحيح|سلم التصحيح/i);
  if (index < 0) return [];
  const tail = text
    .slice(index)
    .replace(/\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\)|\$\$[\s\S]*?\$\$|\$[^$\n]*\$/g, " ") // math content is not a mark
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x0660))
    .replace(/(\d)[٫,](\d)/g, "$1.$2");
  const found = new Set<string>();
  for (const match of tail.matchAll(/(?<![\d.]|[≈~]\s*)(\d{1,2}\.\d{1,3})(?![\d.])/g)) {
    const value = Number(match[1]);
    if (value > 0 && value <= 20 && Math.abs(value * 4 - Math.round(value * 4)) > 1e-9) found.add(match[1]);
  }
  return [...found];
}
