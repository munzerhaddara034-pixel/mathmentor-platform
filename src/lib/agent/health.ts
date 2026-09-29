/**
 * Platform health snapshot — real key presence + mock latency / 5xx if no APM.
 */

import { createId } from "@/lib/ids";
import { hasHeyGenKey } from "@/lib/studio/heygen";
import { geminiApiKey, openaiSolverKey } from "@/lib/solver/llm";
import { whatsappConfigured } from "@/lib/whatsapp/adapter";
import { saveHealth } from "./store";
import type { PlatformHealthMetric, PlatformHealthSnapshot } from "./types";

function mockRecentErrors(): PlatformHealthMetric[] {
  const now = Date.now();
  return [
    {
      endpoint: "/api/solve-math",
      statusCode: 502,
      latencyMs: 2100,
      at: new Date(now - 3600_000).toISOString(),
    },
    {
      endpoint: "/api/heygen/generate",
      statusCode: 503,
      latencyMs: 890,
      at: new Date(now - 7200_000).toISOString(),
    },
    {
      endpoint: "/api/voice-math",
      statusCode: 200,
      latencyMs: 420,
      at: new Date(now - 600_000).toISOString(),
    },
  ];
}

export async function collectPlatformHealth(): Promise<PlatformHealthSnapshot> {
  try {
    const keysPresent = {
      openai: openaiSolverKey().length > 0,
      heygen: hasHeyGenKey(),
      gemini: geminiApiKey().length > 0,
      whatsapp: whatsappConfigured(),
    };
    const recentErrors = mockRecentErrors();
    const avgLatencyMs = Math.round(
      recentErrors.reduce((s, m) => s + m.latencyMs, 0) / Math.max(1, recentErrors.length),
    );
    const notices: string[] = [];
    if (!keysPresent.openai) notices.push("OPENAI_API_KEY missing — Whisper demo fallback.");
    if (!keysPresent.heygen) notices.push("HEYGEN_API_KEY missing — mock marketing videos.");
    if (!keysPresent.gemini) notices.push("GEMINI_API_KEY missing — heuristic intent.");
    if (!keysPresent.whatsapp) notices.push("WhatsApp tokens missing — outbox log only.");
    notices.push("APM not configured — showing synthetic 502/503 samples for the ops dashboard.");

    const snapshot: PlatformHealthSnapshot = {
      id: createId("health"),
      checkedAt: new Date().toISOString(),
      apiStatus: "demo",
      recentErrors,
      avgLatencyMs,
      notices,
      keysPresent,
    };
    return saveHealth(snapshot);
  } catch (error) {
    const snapshot: PlatformHealthSnapshot = {
      id: createId("health"),
      checkedAt: new Date().toISOString(),
      apiStatus: "degraded",
      recentErrors: [],
      avgLatencyMs: 0,
      notices: [error instanceof Error ? error.message : "health collect failed"],
      keysPresent: { openai: false, heygen: false, gemini: false, whatsapp: false },
    };
    return saveHealth(snapshot);
  }
}
