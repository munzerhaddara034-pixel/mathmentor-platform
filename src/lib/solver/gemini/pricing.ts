/**
 * Gemini Developer API list prices, USD per 1M tokens (standard tier).
 * Checked 2026-09-30; gemini-3-flash-preview corrected 2026-10-06 against the official pricing page
 * (Yasmine cost study v2, §7(d).2): $0.50 input (text / image / video), $3.00 output.
 * Audio input for that model is $1.00/1M, but callers report one prompt-token total, so text price is used.
 * Order matters: the first matching pattern wins.
 */
type Price = { input: number; output: number };

const PRICES: ReadonlyArray<[RegExp, Price]> = [
  [/pro/i, { input: 2, output: 12 }],
  [/gemini-3-flash-preview/i, { input: 0.5, output: 3 }],
  [/3\.5-flash-lite|flash-lite-latest/i, { input: 0.3, output: 2.5 }],
  [/3\.1-flash-lite/i, { input: 0.25, output: 1.5 }],
  [/3\.5-flash$/i, { input: 1.5, output: 9 }],
  [/flash/i, { input: 0.75, output: 3.75 }],
];

export type TokenUsage = { promptTokens: number; outputTokens: number };

/** Output includes thinking tokens (billed as output). */
export function costUsd(model: string, usage: TokenUsage): number {
  const price = PRICES.find(([pattern]) => pattern.test(model))?.[1] ?? { input: 0.75, output: 3.75 };
  return (usage.promptTokens * price.input + usage.outputTokens * price.output) / 1_000_000;
}
