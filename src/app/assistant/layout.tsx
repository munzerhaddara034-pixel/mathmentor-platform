import { AuthClientGuard } from "@/components/auth/AuthClientGuard";
import { requireStaff } from "@/lib/auth/guards";
import { privateRobotsMetadata } from "@/lib/auth/metadata";

export const metadata = privateRobotsMetadata;
export const dynamic = "force-dynamic";

export default async function AssistantLayout({ children }: { children: React.ReactNode }) {
  await requireStaff("/assistant");
  return (
    <>
      <AuthClientGuard mode="staff" />
      {children}
    </>
  );
}
