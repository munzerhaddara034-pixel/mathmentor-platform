import { publicUserById } from "@/lib/auth/store";
import { bookingClassroomUrl, studentJoinUrl } from "@/lib/live/joinLink";
import { bookingsNeedingReminder, patchBooking } from "@/lib/live/store";
import type { LiveBooking } from "@/lib/live/types";
import { getMathQuery, listMathQueries, patchMathQuery } from "@/lib/solver/store";
import type { MathQueryRecord } from "@/lib/solver/types";
import { getHeyGenJob } from "@/lib/studio/heygenJobs";
import { resolvePaymentSettings } from "@/lib/payments/config";
import { sendWhatsApp, teacherWhatsApp } from "./adapter";

/** Whish number shown in booking / subscription messages (PAYMENTS_WHISH_NUMBER, default 70772968). */
const WHISH_PHONE = resolvePaymentSettings(null).whish.number;
const TEACHER_AR = "منذر أحمد حداره";
const TEACHER_EN = "Munzer Ahmad Haddara";

function appOrigin() {
  return (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
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
    body: `${TEACHER_EN} · MathMentor\nHi ${input.name}, your card is active.\nPlan: ${input.planName}\nCode: ${input.code}`,
    bodyAr: `${TEACHER_AR} · MathMentor\nأهلاً ${input.name}، تم تفعيل بطاقتك.\nالباقة: ${input.planName}\nالرمز: ${input.code}`,
  });
}

export async function notifyLiveReminder(booking: LiveBooking) {
  const when = new Date(booking.startsAt).toLocaleString("en-GB", {
    timeZone: "Asia/Beirut",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  const link = studentJoinUrl(booking);
  const body = `${TEACHER_EN} · MathMentor\nReminder: live 1-on-1 in ~30 minutes (${when} Asia/Beirut).\nJoin: ${link}`;
  const bodyAr = `${TEACHER_AR} · MathMentor\nتذكير: حصة مباشرة بعد نحو 30 دقيقة (${when} بتوقيت بيروت).\nانضم: ${link}`;

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

export async function notifyLiveBooked(booking: LiveBooking) {
  const when = new Date(booking.startsAt).toLocaleString("en-GB", {
    timeZone: "Asia/Beirut",
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const link = bookingClassroomUrl(booking);
  const joinLink = studentJoinUrl(booking);
  const phone = booking.studentPhone || "(no phone)";
  const pending = booking.status === "pending_payment" || booking.paymentStatus === "pending";
  const paid = booking.paymentStatus === "paid";
  const statusEn = paid ? "PAID / confirmed" : pending ? "PENDING Whish transfer" : booking.status;
  const statusAr = paid ? "مدفوع / مؤكد" : pending ? "بانتظار تحويل Whish" : booking.status;
  const amount =
    booking.paymentAmount != null
      ? `${booking.paymentAmount} ${booking.paymentCurrency || "USD"}`
      : booking.pricingTier === "external"
        ? "25 USD"
        : "15 USD";

  const body = `${TEACHER_AR} · MathMentor
${TEACHER_EN} · MathMentor
Live booking — ${statusEn}
Student: ${booking.studentName}
Phone: ${phone}
Starts: ${when} Asia/Beirut
Amount: ${amount}
Whish transfer to: ${WHISH_PHONE} (${TEACHER_AR})
Classroom: ${link}
Booking id: ${booking.id}`;

  const bodyAr = `${TEACHER_AR} · MathMentor
حجز حصة مباشرة — ${statusAr}
الطالب: ${booking.studentName}
الهاتف: ${phone}
الوقت: ${when} بتوقيت بيروت
المبلغ: ${amount}
حوّل Whish إلى: ${WHISH_PHONE} (${TEACHER_AR})
القاعة: ${link}
رقم الحجز: ${booking.id}`;

  const teacher = await sendWhatsApp({
    to: teacherWhatsApp(),
    kind: "live_booked",
    relatedId: booking.id,
    body,
    bodyAr,
  });

  let student;
  if (booking.studentPhone?.trim()) {
    student = await sendWhatsApp({
      to: booking.studentPhone,
      kind: "live_booked",
      relatedId: booking.id,
      body: paid
        ? `${TEACHER_EN} · MathMentor\nLive session confirmed.\nStarts: ${when} Asia/Beirut\nJoin: ${joinLink}\nBooking: ${booking.id}`
        : `${TEACHER_EN} · MathMentor\nBooking received — transfer ${amount} via Whish to ${WHISH_PHONE} (${TEACHER_AR}), then tap “I've transferred”.\nStarts: ${when} Asia/Beirut\nBooking: ${booking.id}`,
      bodyAr: paid
        ? `${TEACHER_AR} · MathMentor\nتم تأكيد حصتك المباشرة.\nالوقت: ${when} بتوقيت بيروت\nانضم: ${joinLink}\nالحجز: ${booking.id}`
        : `${TEACHER_AR} · MathMentor\nتم استلام الحجز — حوّل ${amount} عبر Whish إلى ${WHISH_PHONE} (${TEACHER_AR}) ثم اضغط «لقد حوّلت».\nالوقت: ${when} بتوقيت بيروت\nالحجز: ${booking.id}`,
    });
  }
  return { teacher, student };
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
      body: `Open the player to watch ${TEACHER_EN}.`,
      bodyAr: `افتح المشغّل لمشاهدة شرح ${TEACHER_AR}.`,
      href: path,
      relatedId: `video-${query.id}`,
    });
  } catch {
    /* optional */
  }
  const phone = user?.contactPhone;
  if (!phone) {
    await patchMathQuery(query.id, { videoNotifiedAt: new Date().toISOString() });
    return undefined;
  }
  const origin = appOrigin();
  const url = origin ? `${origin}${path}` : path;
  const message = await sendWhatsApp({
    to: phone,
    kind: "video_ready",
    relatedId: query.id,
    body: `${TEACHER_EN} · MathMentor\nYour AI explanation video is ready.\nOpen: ${url}`,
    bodyAr: `${TEACHER_AR} · MathMentor\nشرح الفيديو جاهز.\nافتح: ${url}`,
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
  const due = await bookingsNeedingReminder();
  const reminderResults = [];
  for (const booking of due) {
    reminderResults.push(await notifyLiveReminder(booking));
  }
  try {
    const { ensureUpcomingLiveAlerts } = await import("@/lib/notifications/liveReminders");
    await ensureUpcomingLiveAlerts();
  } catch {
    /* optional */
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

export async function notifySubscribeRequest(
  order: {
    id: string;
    studentName: string;
    studentPhone: string;
    planName: string;
    planNameAr: string;
    period: string;
    amount: number;
    currency?: string;
    status: string;
  },
  opts?: { transferClaimed?: boolean },
) {
  const amount = `${order.amount} ${order.currency || "USD"}`;
  const periodEn = order.period === "monthly" ? "monthly" : "term";
  const periodAr = order.period === "monthly" ? "شهري" : "فصل";
  const claimed = Boolean(opts?.transferClaimed) || order.status === "transfer_claimed";
  const statusEn = claimed ? "STUDENT MARKED TRANSFERRED" : "PENDING Whish transfer";
  const statusAr = claimed ? "الطالب أكّد التحويل" : "بانتظار تحويل Whish";

  const body = `${TEACHER_AR} · MathMentor
${TEACHER_EN} · MathMentor
Subscription — ${statusEn}
Student: ${order.studentName}
Phone: ${order.studentPhone || "(no phone)"}
Plan: ${order.planName} (${periodEn})
Amount: ${amount}
Whish transfer to: ${WHISH_PHONE} (${TEACHER_AR})
Order id: ${order.id}
Confirm in /subscribe or billing.`;

  const bodyAr = `${TEACHER_AR} · MathMentor
اشتراك — ${statusAr}
الطالب: ${order.studentName}
الهاتف: ${order.studentPhone || "(بدون هاتف)"}
الباقة: ${order.planNameAr} (${periodAr})
المبلغ: ${amount}
حوّل Whish إلى: ${WHISH_PHONE} (${TEACHER_AR})
رقم الطلب: ${order.id}
أكّد من /subscribe.`;

  const teacher = await sendWhatsApp({
    to: teacherWhatsApp(),
    kind: "subscribe_request",
    relatedId: order.id,
    body,
    bodyAr,
  });

  let student;
  if (order.studentPhone?.trim()) {
    student = await sendWhatsApp({
      to: order.studentPhone,
      kind: "subscribe_request",
      relatedId: order.id,
      body: claimed
        ? `${TEACHER_EN} · MathMentor\nWe received your transfer mark for ${order.planName}. Waiting for teacher confirmation.\nAmount: ${amount}\nOrder: ${order.id}`
        : `${TEACHER_EN} · MathMentor\nSubscription request received — transfer ${amount} via Whish to ${WHISH_PHONE} (${TEACHER_AR}), then tap “I've transferred”.\nPlan: ${order.planName} (${periodEn})\nOrder: ${order.id}`,
      bodyAr: claimed
        ? `${TEACHER_AR} · MathMentor\nتم تسجيل تحويل ${order.planNameAr}. بانتظار تأكيد الأستاذ.\nالمبلغ: ${amount}\nالطلب: ${order.id}`
        : `${TEACHER_AR} · MathMentor\nتم استلام طلب الاشتراك — حوّل ${amount} عبر Whish إلى ${WHISH_PHONE} (${TEACHER_AR}) ثم اضغط «لقد حوّلت».\nالباقة: ${order.planNameAr} (${periodAr})\nالطلب: ${order.id}`,
    });
  }
  return { teacher, student };
}
