/** `{name}` placeholders → values. Messages stay plain strings so they serialise to client components. */
export function fmt(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in vars ? String(vars[key]) : match));
}

/** Pick the plural form: `one` for 1, `few` for 2–10 (Arabic «أيام»), `other` otherwise. */
export type PluralForms = { one: string; few?: string; other: string };
export function plural(n: number, forms: PluralForms): string {
  if (n === 1) return forms.one;
  if (forms.few && n >= 2 && n <= 10) return forms.few;
  return forms.other;
}
