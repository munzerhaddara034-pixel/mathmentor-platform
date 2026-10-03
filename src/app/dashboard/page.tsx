import { redirect } from "next/navigation";
import { ParentDashboard } from "@/components/ParentDashboard";
import { StudentDashboard } from "@/components/StudentDashboard";
import { TeacherOpsPanel } from "@/components/TeacherOpsPanel";
import { buildRoleDashboard } from "@/lib/auth/dashboard";
import { getFreshSession } from "@/lib/auth/server";

export default async function DashboardPage() {
  const user = await getFreshSession();
  if (!user) redirect("/login?next=/dashboard");
  if (user.role === "teacher") return <TeacherOpsPanel />;
  const data = buildRoleDashboard(user);
  if (user.role === "parent") return <ParentDashboard data={data} />;
  return <StudentDashboard data={data} />;
}
