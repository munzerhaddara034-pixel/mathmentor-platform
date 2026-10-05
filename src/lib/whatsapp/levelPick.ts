/**
 * WhatsApp level picker when the solver cannot tell middle / secondary / university.
 * Meta: interactive reply buttons. UltraMsg / Twilio / log: numbered text.
 * Remembers the choice per phone for the thread (in-memory, 12 h TTL).
 */
import type { SolverLevel } from "@/lib/solver/curriculum/types";
import { trackForLevel } from "@/lib/solver/curriculum/detect";

export type LevelChoice = SolverLevel;

export const LEVEL_BUTTONS: ReadonlyArray<{ id: string; title: string; level: LevelChoice }> = [
  { id: "level_middle", title: "متوسط", level: "middle" },
  { id: "level_secondary", title: "ثانوي", level: "secondary" },
  { id: "level_university", title: "جامعي", level: "university" },
];

/** Body shown with the three options (also the Meta interactive body). */
export const LEVEL_ASK_AR =
  "قبل ما حلّ المسألة، حدّد مستواك حتى جاوبك بالطريقة الصح (بدون خلط أساليب):\n" +
  "١) متوسط (Brevet / صف ٧–٩)\n" +
  "٢) ثانوي (رسمي لبناني / IB / Bac / SAT…)\n" +
  "٣) جامعي (براهين صارمة)\n" +
  "اختَر زرّاً أو ردّ: 1 أو 2 أو 3 (أو: متوسط / ثانوي / جامعي).";

/** Numbered fallback for providers without interactive buttons. */
export const LEVEL_ASK_NUMBERED_AR = `${LEVEL_ASK_AR}\n\n1 متوسط · 2 ثانوي · 3 جامعي`;

export type PendingLevelSolve = {
  question: string;
  wantPdf: boolean;
  imageBase64?: string;
  mimeType?: string;
  imageName?: string;
  at: number;
};

const TTL_MS = 12 * 60 * 60 * 1000;
const MAX = 200;
const pendingByPhone = new Map<string, PendingLevelSolve>();
const levelByPhone = new Map<string, { level: LevelChoice; at: number }>();

function digits(phone: string): string {
  return phone.replace(/\D/g, "");
}

function sweep(map: Map<string, { at: number }>, now: number) {
  for (const [key, value] of map) if (now - value.at > TTL_MS) map.delete(key);
  while (map.size > MAX) {
    const oldest = map.keys().next();
    if (oldest.done) break;
    map.delete(oldest.value);
  }
}

export function rememberPendingLevelSolve(phone: string, pending: Omit<PendingLevelSolve, "at">): void {
  const key = digits(phone);
  if (!key) return;
  const now = Date.now();
  sweep(pendingByPhone, now);
  pendingByPhone.delete(key);
  pendingByPhone.set(key, { ...pending, at: now });
}

export function recallPendingLevelSolve(phone: string): PendingLevelSolve | undefined {
  const key = digits(phone);
  const hit = pendingByPhone.get(key);
  if (!hit) return undefined;
  if (Date.now() - hit.at > TTL_MS) {
    pendingByPhone.delete(key);
    return undefined;
  }
  return hit;
}

export function clearPendingLevelSolve(phone: string): void {
  pendingByPhone.delete(digits(phone));
}

export function rememberThreadLevel(phone: string, level: LevelChoice): void {
  const key = digits(phone);
  if (!key) return;
  const now = Date.now();
  sweep(levelByPhone, now);
  levelByPhone.delete(key);
  levelByPhone.set(key, { level, at: now });
}

export function recallThreadLevel(phone: string): LevelChoice | undefined {
  const key = digits(phone);
  const hit = levelByPhone.get(key);
  if (!hit) return undefined;
  if (Date.now() - hit.at > TTL_MS) {
    levelByPhone.delete(key);
    return undefined;
  }
  return hit.level;
}

/** Parse a button id, a digit 1/2/3, or an Arabic/English/French level word. */
export function parseLevelChoice(raw: string | undefined | null): LevelChoice | undefined {
  if (!raw) return undefined;
  const text = raw.trim();
  if (!text) return undefined;
  const lower = text.toLowerCase();
  for (const button of LEVEL_BUTTONS) {
    if (text === button.id || text === button.title) return button.level;
  }
  if (/^(?:1|١|one)$/i.test(text) || /^(?:متوسط|middle|brevet|coll[eè]ge)$/i.test(lower)) return "middle";
  if (/^(?:2|٢|two)$/i.test(text) || /^(?:ثانوي|secondary|terminale|bac|lyc[eé]e)$/i.test(lower)) return "secondary";
  if (/^(?:3|٣|three)$/i.test(text) || /^(?:جامعي|university|undergrad(?:uate)?)$/i.test(lower)) return "university";
  // "1 متوسط" / "٢) ثانوي"
  if (/^[1١]\b/.test(text) && /متوسط|middle|brevet/i.test(text)) return "middle";
  if (/^[2٢]\b/.test(text) && /ثانوي|secondary|bac/i.test(text)) return "secondary";
  if (/^[3٣]\b/.test(text) && /جامعي|university/i.test(text)) return "university";
  if (/^[1١]$/.test(text)) return "middle";
  if (/^[2٢]$/.test(text)) return "secondary";
  if (/^[3٣]$/.test(text)) return "university";
  return undefined;
}

export function levelSolveHints(level: LevelChoice): { level: LevelChoice; track: string } {
  return { level, track: trackForLevel(level) };
}

/** Reset in-memory maps (unit tests). */
export function resetLevelPickStoresForTests(): void {
  pendingByPhone.clear();
  levelByPhone.clear();
}
