/** Team-chat turns (text + inline files) → router turns (text only; attachments become a short note). */
import type { LlmTurn } from "@/lib/team/gemini";
import type { RouterTurn } from "../models/providers";

export function toRouterTurns(turns: LlmTurn[]): RouterTurn[] {
  return turns
    .map((turn) => ({
      role: turn.role,
      text: turn.parts
        .map((part) => ("text" in part ? part.text : `[مرفق ${part.inlineData.mimeType} — غير متاح لحمزة، اطلب وصفه نصياً إن لزم]`))
        .join("\n")
        .trim(),
    }))
    .filter((turn) => turn.text);
}
