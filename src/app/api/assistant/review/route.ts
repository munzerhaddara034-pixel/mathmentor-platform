import { NextResponse } from "next/server";
import { reviewOutreach } from "@/lib/store";

export async function POST(request: Request) {
  const body = (await request.json()) as { id?: string; status?: "approved" | "rejected"; professorNote?: string };
  if (!body.id || !body.status) return NextResponse.json({ error: "Missing review." }, { status: 400 });
  const item = await reviewOutreach(body.id, body.status, body.professorNote);
  if (!item) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json(item);
}
