import { NextResponse } from "next/server";
import { createId } from "@/lib/ids";
import { addLibraryItem } from "@/lib/store";
import type { GradeTrack, Language, SourceKind } from "@/lib/types";

export async function POST(request: Request) {
  const form = await request.formData();
  const title = String(form.get("title") ?? "").trim();
  const kind = String(form.get("kind") ?? "book") as SourceKind;
  const track = String(form.get("track") ?? "grade-9") as GradeTrack;
  const subject = String(form.get("subject") ?? "").trim();
  const language = String(form.get("language") ?? "ar") as Language;
  const notes = String(form.get("notes") ?? "").trim();
  const pastedText = String(form.get("extractedText") ?? "").trim();
  const file = form.get("file");

  let fileName = "pasted-text.txt";
  let extractedText = pastedText;
  if (file instanceof File && file.size > 0) {
    fileName = file.name;
    if (file.type.startsWith("text/") || file.name.endsWith(".md") || file.name.endsWith(".txt")) {
      extractedText = `${pastedText}\n${await file.text()}`.trim();
    }
  }

  if (!title || !extractedText) {
    return NextResponse.json(
      { error: "أضف عنواناً ونصاً مستخرجاً من الكتاب أو النموذج." },
      { status: 400 },
    );
  }

  const item = await addLibraryItem({
    id: createId("lib"),
    title,
    kind: ["book", "exam-model", "worksheet", "solution-guide"].includes(kind) ? kind : "book",
    track: ["grade-7", "grade-8", "grade-9", "grade-11", "grade-12", "sat"].includes(track) ? track : "grade-9",
    subject: subject || title,
    language: language === "en" ? "en" : "ar",
    fileName,
    notes,
    extractedText,
    createdAt: new Date().toISOString(),
  });

  return NextResponse.json(item);
}
