import { AdminPanel } from "@/components/AdminPanel";
import { redirect } from "next/navigation";
import { getFreshSession } from "@/lib/auth/server";

export default async function AdminPage() {
  const user = await getFreshSession();
  if (!user) redirect("/login?next=/admin");
  if (user.role !== "teacher") redirect("/dashboard");
  return <AdminPanel />;
}
