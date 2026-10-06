/** Parses the first JSON object in an LLM answer (tolerates ```json fences). Pure. */
export function parseJsonObject(text: string): Record<string, unknown> | null {
  const trimmed = text.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fence ? fence[1] : trimmed;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const parsed: unknown = JSON.parse(raw.slice(start, end + 1));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export function str(record: Record<string, unknown> | null | undefined, key: string, max = 4000): string {
  const value = record?.[key];
  return typeof value === "string" ? value.slice(0, max) : "";
}
