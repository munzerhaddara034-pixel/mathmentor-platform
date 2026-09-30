import { NextResponse } from "next/server";
import { apiSession } from "@/lib/auth/guards";
import { isStaffRole } from "@/lib/auth/paths";
import { redactStoreForViewer } from "@/lib/security/contentRedaction";
import { readStore } from "@/lib/store";

/**
 * Store snapshot for the classroom/student/professor pages.
 * Previously public and unredacted (leaked scratch-card codes, entitlements, manager chat):
 * now requires a session, and non-staff only get the fields the student pages read.
 */
export async function GET() {
  const guard = await apiSession();
  if (guard.error) return guard.error;
  const store = await readStore();
  return NextResponse.json(redactStoreForViewer(store, { staff: isStaffRole(guard.live.user.role) }));
}
