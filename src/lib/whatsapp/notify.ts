import { publicUserById } from "@/lib/auth/store";
import { bookingsNeedingReminder, patchBooking } from "@/lib/live/store";
import type { LiveBooking } from "@/lib/live/types";
import { getMathQuery, listMathQueries, patchMathQuery } from "@/lib/solver/store";
import { getHeyGenJob } from "@/lib/studio/heygenJobs";
import type { MathQueryRecord } from "@/lib/solver/types";
import { sendWhatsApp, teacherWhatsApp } from "./adapter";

function appOrigin() {
  return (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "") || "";
}

export async function notifyActivation(input: {
  phone: string;
  name: string;
  planName: string;
  code: string;
  userId?: string;
}) {
  return sendWhatsApp({
    to: input.phone,
    kind: "activation",
    relatedId: input.userId || input.code,
    body: `MathMentor · Prof. Munzer Haddara\nHi ${input.name}, your card is active.\nPlan: ${input.planName}\nCode: ${input.code}`,
    bodyAr: `أكاديمية منذر حداره\nأهلاً ${input.name}، تم تفعيل بطاقتك.\nالباقة: ${input.planName}\nالرمز: ${input.code}`,
  });
}

export async function notifyLiveReminder(booking: LiveBooking) {
  const when = new Date(booking.startsAt).toLocaleString("en-GB", {
    timeZone: "Asia/Beirut",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  const link = booking.meetingLink || "(link pending)";
  const body = `Reminder: live 1-on-1 with Prof. Munzer Haddara in ~30 minutes (${when} Asia/Beirut).\nJoin: ${link}`;
  const bodyAr = `تذكير: حصة مباشرة مع الأستاذ منذر حداره بعد نحو 30 دقيقة (${when} بتوقيت بيروت).\nالرابط: ${link}`;

  const student = await sendWhatsApp({
    to: booking.studentPhone,
    kind: "live_reminder",
    relatedId: booking.id,
    body,
    bodyAr,
  });
  const teacher = await sendWhatsApp({
    to: teacherWhatsApp(),
    kind: "live_reminder",
    relatedId: booking.id,
    body: `Teacher copy · ${booking.studentName} (${booking.studentPhone})\n${body}`,
    bodyAr: `نسخة الأستاذ · ${booking.studentName}\n${bodyAr}`,
  });
  await patchBooking(booking.id, { reminderSentAt: new Date().toISOString() });
  return { student, teacher };
}

export async function notifyVideoReady(query: MathQueryRecord) {
  if (query.videoNotifiedAt || query.needsRetake) return undefined;
  const user = await publicUserById(query.userId);
  const path = `/math-solver/result/${encodeURIComponent(query.id)}`;
  try {
    const { pushNotification } = await import("@/lib/notifications/store");
    await pushNotification({
      userId: query.userId,
      audience: "student",
      kind: "video_ready",
      title: "AI video explanation ready",
      titleAr: "شرح الفيديو جاهز",
      body: "Open the split player to watch Prof. Munzer Haddara.",
      bodyAr: "افتح المشغّل لمشاهدة شرح الأستاذ منذر حداره.",
      href: path,
      relatedId: `video-${query.id}`,
    });
  } catch {
    /* store optional */
  }
  const phone = user?.phone;
  if (!phone) {
    await patchMathQuery(query.id, { videoNotifiedAt: new Date().toISOString() });
    return undefined;
  }
  const origin = appOrigin();
  const path = `/math-solver/result/${encodeURIComponent(query.id)}`;
  const url = origin ? `${origin}${path}` : path;
  const message = await sendWhatsApp({
    to: phone,
    kind: "video_ready",
    relatedId: query.id,
    body: `Your AI explanation video is ready (Prof. Munzer Haddara).\nOpen: ${url}`,
    bodyAr: `شرح الفيديو جاهز (الأستاذ منذر حداره).\nافتح: ${url}`,
  });
  await patchMathQuery(query.id, { videoNotifiedAt: new Date().toISOString() });
  return message;
}

export async function notifyVideoJobIfReady(jobId: string) {
  const queries = await listMathQueries({ limit: 400 });
  const query = queries.find((item) => item.heygenJobId === jobId);
  if (!query || query.videoNotifiedAt) return undefined;
  const job = await getHeyGenJob(jobId);
  const ready =
    query.videoStatus === "completed" ||
    query.videoStatus === "demo" ||
    job?.status === "completed" ||
    Boolean(query.videoUrl);
  if (!ready) return undefined;
  return notifyVideoReady(query);
}

export async function runWhatsAppJobs() {
  const remindersDue = await bookingsNeedingReminder();
  const reminderResults = [];
  for (const booking of remindersDue) {
    reminderResults.push(await notifyLiveReminder(booking));
  }

  try {
    const { ensureUpcomingLiveAlerts } = await import("@/lib/notifications/liveReminders");
    await ensureUpcomingLiveAlerts();
  } catch {
    /* in-app 15-min alerts optional */
  }

  const queries = await listMathQueries({ limit: 400 });
  const videoResults = [];
  for (const query of queries) {
    if (query.videoNotifiedAt || query.needsRetake) continue;
    if (query.videoStatus === "completed" || query.videoStatus === "demo") {
      videoResults.push(await notifyVideoReady(query));
    } else if (query.heygenJobId) {
      videoResults.push(await notifyVideoJobIfReady(query.heygenJobId));
    }
  }

  return {
    reminders: reminderResults.length,
    videos: videoResults.filter(Boolean).length,
    at: new Date().toISOString(),
  };
}

export async function notifyQueryVideoById(queryId: string) {
  const query = await getMathQuery(queryId);
  if (!query) return undefined;
  return notifyVideoReady(query);
}
