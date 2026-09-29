import { AuthClientGuard } from "@/components/auth/AuthClientGuard";
import { requireAuth } from "@/lib/auth/guards";
import { privateRobotsMetadata } from "@/lib/auth/metadata";

export const metadata = privateRobotsMetadata;
export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Role dashboard: students, parents and staff (teacher console) all land here after login.
  await requireAuth("/dashboard");
  return (
    <>
      <AuthClientGuard mode="auth" />
      {children}
    </>
  );
}
