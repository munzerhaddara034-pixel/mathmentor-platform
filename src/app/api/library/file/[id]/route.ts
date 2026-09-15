import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { readStore } from "@/lib/store";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const store = await readStore();
  const item = store.library.find((entry) => entry.id === id);
  if (!item?.sourcePath) {
    return NextResponse.json({ error: "PDF not linked." }, { status: 404 });
  }
  try {
    const data = await readFile(item.sourcePath);
    return new NextResponse(data, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${encodeURIComponent(item.fileName)}"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "Could not open the PDF from disk." }, { status: 404 });
  }
}
