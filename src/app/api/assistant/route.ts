import { NextResponse } from "next/server";
import { runEmployeeCommand } from "@/lib/commandEngine";
import { createId } from "@/lib/ids";
import { stampMessage } from "@/lib/manager";
import { addCustomLesson, addManagerMessage, addOutreach, patchSettings, readStore } from "@/lib/store";

export async function GET() {
  const store = await readStore();
  return NextResponse.json({
    messages: store.managerMessages,
    outreach: store.outreach,
    settings: store.settings,
  });
}

export async function POST(request: Request) {
  const body = (await request.json()) as { message?: string };
  const text = body.message?.trim();
  if (!text) return NextResponse.json({ error: "Give an order." }, { status: 400 });
  const store = await readStore();
  await addManagerMessage(stampMessage("professor", text));
  const result = runEmployeeCommand(text, store.settings);
  if (result.settingsPatch) await patchSettings(result.settingsPatch);
  if (result.newLesson) await addCustomLesson(result.newLesson);
  if (result.outreach) {
    await addOutreach({ ...result.outreach, id: createId("out"), createdAt: new Date().toISOString() });
  }
  const reply = await addManagerMessage(stampMessage("manager", result.reply));
  const next = await readStore();
  return NextResponse.json({
    reply,
    generatedLessonId: result.generatedLessonId,
    messages: next.managerMessages,
    outreach: next.outreach,
    settings: next.settings,
  });
}
