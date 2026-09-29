import type { AgentIntentKind } from "@/lib/agent/types";

export type AgentSectionId =
  | "agent-campaign-studio"
  | "agent-school-dispatcher"
  | "agent-platform-health"
  | "agent-recent-voice"
  | "agent-staged-approvals"
  | "agent-self-evolution"
  | "agent-whatsapp-setup"
  | "agent-secretary-schedule";

export type AgentSectionTarget = {
  sectionId: AgentSectionId;
  jumpLabelAr: string;
};

const INTENT_SECTION_MAP: Record<AgentIntentKind, AgentSectionTarget | null> = {
  generate_video: {
    sectionId: "agent-campaign-studio",
    jumpLabelAr: "عرض نتيجة الحملة",
  },
  school_report: {
    sectionId: "agent-school-dispatcher",
    jumpLabelAr: "عرض التقرير المدرسي",
  },
  platform_health: {
    sectionId: "agent-platform-health",
    jumpLabelAr: "عرض صحة المنصّة",
  },
  broadcast_message: {
    sectionId: "agent-recent-voice",
    jumpLabelAr: "عرض المهام الصوتية",
  },
  schedule_appointment: {
    sectionId: "agent-secretary-schedule",
    jumpLabelAr: "عرض جدول سكرتير محمد",
  },
  add_reminder: {
    sectionId: "agent-secretary-schedule",
    jumpLabelAr: "عرض مهام محمد والتذكيرات",
  },
  daily_briefing: {
    sectionId: "agent-secretary-schedule",
    jumpLabelAr: "عرض موجز محمد اليومي",
  },
  code_evolution_request: {
    sectionId: "agent-staged-approvals",
    jumpLabelAr: "عرض مسودّة تطوير الكود",
  },
  school_outreach_request: {
    sectionId: "agent-staged-approvals",
    jumpLabelAr: "عرض مسودّة تواصل المدارس",
  },
  general_task: {
    sectionId: "agent-recent-voice",
    jumpLabelAr: "عرض المهام الصوتية",
  },
};

export function mapIntentToSection(kind: string | undefined): AgentSectionTarget | null {
  if (!kind) return null;
  if (kind in INTENT_SECTION_MAP) {
    return INTENT_SECTION_MAP[kind as AgentIntentKind];
  }
  return null;
}

const FLASH_CLASS = "agent-section-flash";
const FLASH_MS = 2500;

/** Scroll to section and apply gold flash. Returns false if element missing. */
export function scrollAndFlashSection(sectionId: string): boolean {
  if (typeof document === "undefined") return false;
  const el = document.getElementById(sectionId);
  if (!el) return false;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  el.classList.remove(FLASH_CLASS);
  // Force reflow so re-adding the class restarts the animation.
  void el.offsetWidth;
  el.classList.add(FLASH_CLASS);
  window.setTimeout(() => {
    el.classList.remove(FLASH_CLASS);
  }, FLASH_MS);
  return true;
}

/**
 * Wait for React paint (rAF ×2) then a short delay before scroll/flash.
 * Retries once if the target node is still missing.
 */
export function scheduleScrollAndFlashSection(
  sectionId: string,
  opts?: { delayMs?: number; retryDelayMs?: number },
): void {
  if (typeof window === "undefined") return;
  const delayMs = opts?.delayMs ?? 220;
  const retryDelayMs = opts?.retryDelayMs ?? 280;

  const run = (retried: boolean) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        window.setTimeout(() => {
          const ok = scrollAndFlashSection(sectionId);
          if (!ok && !retried) {
            window.setTimeout(() => run(true), retryDelayMs);
          }
        }, delayMs);
      });
    });
  };

  run(false);
}
