import { redirect } from "next/navigation";
import { ParentDashboard } from "@/components/ParentDashboard";
import { StudentDashboard } from "@/components/StudentDashboard";
import { TeacherOpsPanel } from "@/components/TeacherOpsPanel";
import { buildRoleDashboard, type RoleDashboard } from "@/lib/auth/dashboard";
import { getFreshSession } from "@/lib/auth/server";
import type { SessionUser } from "@/lib/auth/types";

function dashboardFor(user: SessionUser): RoleDashboard {
  try {
    return buildRoleDashboard(user);
  } catch (error) {
    // SQLite profile DB unavailable (read-only / serverless disk): show an empty dashboard, not a crash.
    console.warn("dashboard: SQLite profile unavailable", error);
    return { user, linkedStudent: null, courses: [], reminders: [] };
  }
}

export default async function DashboardPage() {
  const user = await getFreshSession();
  if (!user) redirect("/login?next=/dashboard");
  if (user.role === "teacher") return <TeacherOpsPanel />;
  const data = dashboardFor(user);
  if (user.role === "parent") return <ParentDashboard data={data} />;
  return <StudentDashboard data={data} />;
}
