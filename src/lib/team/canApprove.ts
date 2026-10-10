import { isTeamApproverEmail } from "@/lib/auth/adminAllowlist";
import type { TeamActor } from "./agents";

/** The owner-only check shared by staff approval routes and deployment operations. */
export function canApprove(actor: TeamActor | null | undefined): boolean {
  return Boolean(actor && isTeamApproverEmail(actor.email));
}
