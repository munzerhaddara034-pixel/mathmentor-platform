/**
 * /api/content used to return the whole store.json to anyone — including unused scratch-card
 * redemption codes, entitlements (names/phones), manager chat and outreach drafts.
 * Staff get everything; signed-in students/parents get only what the student pages read.
 */

type StoreLike = Record<string, unknown> & { scratchCards?: unknown; entitlements?: unknown };

const STUDENT_VISIBLE_KEYS = ["library", "drafts", "settings", "progress", "customLessons", "customQuestions", "exams", "studentChat"] as const;
const STAFF_ONLY_EMPTY_ARRAYS = ["managerMessages", "outreach", "scratchCards", "entitlements", "quizAttempts"] as const;

export function redactStoreForViewer<T extends StoreLike>(store: T, viewer: { staff: boolean }): T {
  if (viewer.staff) return store;
  const out: Record<string, unknown> = {};
  for (const key of STUDENT_VISIBLE_KEYS) if (key in store) out[key] = store[key];
  for (const key of STAFF_ONLY_EMPTY_ARRAYS) out[key] = [];
  // Library items may point at server file paths; never expose those to non-staff.
  if (Array.isArray(out.library)) {
    out.library = (out.library as Record<string, unknown>[]).map((item) => {
      const { sourcePath: _sourcePath, ...rest } = item ?? {};
      return rest;
    });
  }
  return out as T;
}
