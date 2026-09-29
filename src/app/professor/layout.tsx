import { AuthClientGuard } from "@/components/auth/AuthClientGuard";
import { requireStaff } from "@/lib/auth/guards";
import { privateRobotsMetadata } from "@/lib/auth/metadata";

export const metadata = privateRobotsMetadata;
export const dynamic = "force-dynamic";

export default async function ProfessorLayout({ children }: { children: React.ReactNode }) {
  await requireStaff("/professor");
  return (
    <>
      <AuthClientGuard mode="staff" />
      {children}
    </>
  );
}
