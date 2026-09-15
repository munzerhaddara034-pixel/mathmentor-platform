import { NextResponse } from "next/server";
import { generateDraftsFromLibrary } from "@/lib/generate";
import { addDrafts, readStore } from "@/lib/store";

export async function POST(request: Request) {
  const body = (await request.json()) as { libraryItemId?: string };
  const store = await readStore();
  const item = store.library.find((entry) => entry.id === body.libraryItemId);
  if (!item) {
    return NextResponse.json({ error: "المصدر غير موجود." }, { status: 404 });
  }
  const drafts = await addDrafts(generateDraftsFromLibrary(item));
  return NextResponse.json({ drafts });
}
