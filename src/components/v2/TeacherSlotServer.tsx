import type { Messages } from "@/lib/i18n/messages/en";
import { TEACHER_LIVE_STATUS_ENDPOINT, getTeacherLiveStatus } from "@/lib/live/teacherLiveStatus";
import { TeacherSlotView } from "./TeacherSlot";
import { TeacherSlotLive } from "./TeacherSlotLive";

/** Resolves the status on the server; only ships the polling client wrapper once an endpoint exists. */
export async function TeacherSlot({ t, variant, offlineNote }: { t: Messages["teacherSlot"]; variant?: "full" | "compact"; offlineNote?: string | null }) {
  const status = await getTeacherLiveStatus();
  if (TEACHER_LIVE_STATUS_ENDPOINT) return <TeacherSlotLive initial={status} variant={variant} offlineNote={offlineNote} />;
  return <TeacherSlotView status={status} t={t} variant={variant} offlineNote={offlineNote} />;
}
