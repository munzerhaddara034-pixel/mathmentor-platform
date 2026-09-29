import { NextResponse } from "next/server";
import { authorizeJobsRequest } from "@/lib/jobs/auth";
import { runWhatsAppJobs } from "@/lib/whatsapp/notify";

export const runtime = "nodejs";

async function run(request: Request) {
  const auth = await authorizeJobsRequest(request);
  if (!auth.ok) return auth.error;
  const result = await runWhatsAppJobs();
  return NextResponse.json({ ok: true, auth: auth.mode, ...result });
}

export async function POST(request: Request) {
  return run(request);
}

export async function GET(request: Request) {
  return run(request);
}
