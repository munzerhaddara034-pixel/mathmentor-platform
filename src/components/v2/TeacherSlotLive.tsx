"use client";

import { useI18n } from "@/components/i18n/I18nProvider";
import type { TeacherLiveStatus } from "@/lib/live/teacherLiveStatus";
import { TeacherSlotView } from "./TeacherSlot";
import { useTeacherLiveStatus } from "./useTeacherLiveStatus";

/** Client wrapper: server status first, then visibility-aware polling (idle until an endpoint exists). */
export function TeacherSlotLive({ initial, variant, offlineNote }: { initial: TeacherLiveStatus; variant?: "full" | "compact"; offlineNote?: string | null }) {
  const { m } = useI18n();
  const status = useTeacherLiveStatus(initial);
  return <TeacherSlotView status={status} t={m.teacherSlot} variant={variant} offlineNote={offlineNote} />;
}
