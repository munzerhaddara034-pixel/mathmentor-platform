import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { createId } from "@/lib/ids";
import { addStudentChat, readStore } from "@/lib/store";
import { academyLessons } from "@/lib/academyLessons";

function tutorAnswer(question: string, fileName?: string) {
  const q = question.toLowerCase();
  const hint = academyLessons[0];
  if (fileName) {
    return `I received your file “${fileName}”. Write the given on the first line, the rule on the second, then the steps. If this is a limit, simplify before substituting. If this is an equation, keep the balance. Send the next line you wrote and I will mark it. Meanwhile continue your current classroom video and use the independent-check scene.`;
  }
  if (q.includes("next") || q.includes("التالي") || q.includes("stuck") || q.includes("علق")) {
    return `Do not skip. Open your last lesson, pause on the rule box, copy it from memory, then play the independent-check scene. After that open the next chapter in Classroom Studio. If a line is still blocked, send a photo of that line only.`;
  }
  return `I am the classroom tutor. ${hint ? "Keep the four-line method: given, rule, steps, check." : ""} Your question: “${question || "empty"}”. I will not jump to a final number until those four lines exist. Type the given, or upload a notebook photo. Professor Munzer reviews anything that looks like an official-exam full paper.`;
}

export async function GET() {
  const store = await readStore();
  return NextResponse.json({ messages: store.studentChat });
}

export async function POST(request: Request) {
  const form = await request.formData();
  const body = String(form.get("body") ?? "").trim();
  const file = form.get("file");
  let fileName: string | undefined;
  let fileUrl: string | undefined;
  if (file instanceof File && file.size > 0) {
    const dir = path.join(process.cwd(), "public", "uploads");
    await mkdir(dir, { recursive: true });
    const safe = `${Date.now()}-${file.name.replace(/[^\w.\-]+/g, "_")}`;
    const bytes = Buffer.from(await file.arrayBuffer());
    await writeFile(path.join(dir, safe), bytes);
    fileName = file.name;
    fileUrl = `/uploads/${safe}`;
  }
  if (!body && !fileName) {
    return NextResponse.json({ error: "Write a question or attach a file." }, { status: 400 });
  }
  await addStudentChat({
    id: createId("chat"),
    from: "student",
    body: body || "(file attached)",
    fileName,
    fileUrl,
    createdAt: new Date().toISOString(),
  });
  const reply = await addStudentChat({
    id: createId("chat"),
    from: "tutor",
    body: tutorAnswer(body, fileName),
    createdAt: new Date().toISOString(),
  });
  const store = await readStore();
  return NextResponse.json({ reply, messages: store.studentChat });
}
