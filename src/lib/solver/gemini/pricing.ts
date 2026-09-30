/** Gemini Developer API list prices, USD per 1M tokens (standard tier, checked 2026-09-30). */
type Price = { input: number; output: number };

const PRICES: ReadonlyArray<[RegExp, Price]> = [
  [/pro/i, { input: 2, output: 12 }],
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
