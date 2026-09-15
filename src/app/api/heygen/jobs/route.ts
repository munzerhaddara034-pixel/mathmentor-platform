import { NextResponse } from "next/server";
import { guardHeyGenAdmin } from "@/lib/studio/heygenAuth";
import { hasHeyGenKey } from "@/lib/studio/heygen";
import { listHeyGenJobs, playerPathForJob } from "@/lib/studio/heygenJobs";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const guard = guardHeyGenAdmin(request, { write: true });
  if (!guard.ok) return guard.response;
  const jobs = await listHeyGenJobs();
  return NextResponse.json({
    jobs: jobs.map((job) => ({ ...job, playerPath: playerPathForJob(job) })),
    demoMode: !hasHeyGenKey() || guard.demoAuth,
    notice: guard.notice,
  });
}
