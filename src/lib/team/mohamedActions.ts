/** Parses محمد's ```mm-actions``` block and records appointments/reminders in the Agent Hub secretary store. */
import { saveAppointment, saveReminder } from "@/lib/agent/store";
import type { ActionReminderPriority } from "@/lib/agent/types";
import { createId } from "@/lib/ids";
import { parseJsonObject } from "./gemini";
import { sendOwnerWhatsApp } from "./ownerWhatsApp";

const BLOCK_RE = /```mm-actions\s*([\s\S]*?)```/;

function isoOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}

function str(value: unknown, max = 200): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function fmtBeirut(iso: string): string {
  return new Date(iso).toLocaleString("ar-LB", {
    timeZone: "Asia/Beirut",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export async function applyMohamedActions(reply: string): Promise<{ text: string; recorded: string[] }> {
  const match = reply.match(BLOCK_RE);
  if (!match) return { text: reply, recorded: [] };
  const text = reply.replace(BLOCK_RE, "").trim();
  const data = parseJsonObject(match[1]);
  const recorded: string[] = [];
  if (!data) return { text, recorded };
  const now = new Date().toISOString();
  const appointments = Array.isArray(data.appointments) ? data.appointments.slice(0, 5) : [];
  for (const raw of appointments) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Record<string, unknown>;
    const dateTime = isoOrNull(item.dateTime);
    const title = str(item.title);
    if (!dateTime || !title) continue;
    await saveAppointment({
      id: createId("appt"),
      title,
      dateTime,
      contactPerson: str(item.contactPerson) || undefined,
      notes: str(item.notes, 500) || undefined,
      status: "scheduled",
      createdAt: now,
      updatedAt: now,
      source: "hub",
    });
    recorded.push(`موعد: ${title} — ${fmtBeirut(dateTime)} (بتوقيت بيروت)`);
  }
  const reminders = Array.isArray(data.reminders) ? data.reminders.slice(0, 5) : [];
  for (const raw of reminders) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Record<string, unknown>;
    const dueDate = isoOrNull(item.dueDate);
    const task = str(item.task);
    if (!dueDate || !task) continue;
    const priority: ActionReminderPriority =
      item.priority === "low" || item.priority === "medium" || item.priority === "high" ? item.priority : "medium";
    await saveReminder({ id: createId("rem"), task, dueDate, priority, status: "open", createdAt: now, updatedAt: now, source: "hub" });
    recorded.push(`تذكير: ${task} — ${fmtBeirut(dueDate)} (بتوقيت بيروت)`);
  }
  // «محمد» يرسل إلى واتساب رقم المنصة (نص و/أو ملف) — بطلب صريح من الأستاذ منذر فقط.
  const whatsapp = Array.isArray(data.whatsapp) ? data.whatsapp.slice(0, 2) : [];
  for (const raw of whatsapp) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Record<string, unknown>;
    const body = str(item.text, 2000);
    const attachmentId = str(item.attachmentId, 80);
    const link = str(item.link, 500);
    if (!body && !attachmentId && !link) continue;
    const result = await sendOwnerWhatsApp({
      text: body,
      file:
        attachmentId || link
          ? {
              attachmentId: attachmentId || undefined,
              link: link || undefined,
              filename: str(item.filename, 120) || undefined,
              mimeType: str(item.mimeType, 120) || undefined,
            }
          : undefined,
    });
    recorded.push(`واتساب: ${result.detailAr}`);
  }
  return { text, recorded };
}
