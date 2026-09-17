import { NextResponse } from "next/server";
import { ingestAhliaBooks, withAhliaMerge } from "@/lib/ingestAhlia";
import { readStore, writeStore } from "@/lib/store";

export async function POST() {
  const store = await readStore();
  const { added, skipped } = await ingestAhliaBooks(store.library);
  if (added.length) {
    await writeStore(withAhliaMerge(store, added));
  }
  return NextResponse.json({ added: added.length, skipped: skipped.length, books: added.map((item) => item.title) });
}
