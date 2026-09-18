import { pushNotification } from "@/lib/notifications/store";
import { deviceDisplayName, formatDeviceTimestamp } from "./device";
import { isSessionSharingExempt } from "./paths";
import type { AuthSession, AuthUser } from "./store";

export async function notifyStaffDeviceLogin(
  user: Pick<AuthUser, "id" | "role" | "email" | "name">,
  session: AuthSession,
) {
  if (!isSessionSharingExempt(user)) return undefined;
  const described = deviceDisplayName(session.userAgent, session.deviceClass);
  const when = formatDeviceTimestamp(session.createdAt);
  return pushNotification({
    userId: user.id,
    audience: "teacher",
    kind: "device_login",
    title: "New active device",
    titleAr: "جهاز جديد نشط",
    body: `${described.nameWithClass} signed in at ${when} (Asia/Beirut).`,
    bodyAr: `تم الدخول من ${described.nameWithClassAr} في ${when} (توقيت بيروت).`,
    href: "/dashboard",
    relatedId: session.id,
  });
}
