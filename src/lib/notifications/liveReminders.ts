import { bookingsNeedingReminder } from "@/lib/live/store";
import { pushNotification } from "./store";

export async function ensureUpcomingLiveAlerts() {
  const due = await bookingsNeedingReminder(10, 20);
  for (const booking of due) {
    const when = new Date(booking.startsAt).toLocaleString("en-GB", {
      timeZone: "Asia/Beirut",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
    await pushNotification({
      userId: booking.studentId,
      audience: "student",
      kind: "live_upcoming",
      title: "Live session in about 15 minutes",
      titleAr: "حصة مباشرة بعد نحو 15 دقيقة",
      body: `Prof. Munzer Haddara · ${when} Asia/Beirut. انضم للحصة from the classroom.`,
      bodyAr: `الأستاذ منذر حداره · ${when} بتوقيت بيروت.`,
      href: booking.classroomUrl || `/live/classroom/${encodeURIComponent(booking.id)}`,
      relatedId: `upcoming-${booking.id}`,
    });
  }
  return due.length;
}
