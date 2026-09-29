import { AuthClientGuard } from "@/components/auth/AuthClientGuard";
import { requireAuth } from "@/lib/auth/guards";
import { privateRobotsMetadata } from "@/lib/auth/metadata";

export const metadata = privateRobotsMetadata;
export const dynamic = "force-dynamic";

export default async function RedeemLayout({ children }: { children: React.ReactNode }) {
  await requireAuth("/redeem");
  return (
    <>
      <AuthClientGuard mode="auth" />
      {children}
    </>
  );
}
