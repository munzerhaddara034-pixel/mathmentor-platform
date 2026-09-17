import { AuthClientGuard } from "@/components/auth/AuthClientGuard";
import { requireLiveAccess } from "@/lib/auth/guards";
import { privateRobotsMetadata } from "@/lib/auth/metadata";

export const metadata = privateRobotsMetadata;
export const dynamic = "force-dynamic";

export default async function LiveLayout({ children }: { children: React.ReactNode }) {
  await requireLiveAccess("/live");
  return (
    <>
      <AuthClientGuard mode="live" />
      {children}
    </>
  );
}
