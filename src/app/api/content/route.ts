import { NextResponse } from "next/server";
import { readStore } from "@/lib/store";

export async function GET() {
  const store = await readStore();
  const { scratchCards: _cards, entitlements: _ents, ...publicStore } = store;
  return NextResponse.json({ ...publicStore, scratchCards: [], entitlements: [] });
}
