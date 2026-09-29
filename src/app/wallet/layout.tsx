import { AuthClientGuard } from "@/components/auth/AuthClientGuard";
import { requireAuth } from "@/lib/auth/guards";
import { privateRobotsMetadata } from "@/lib/auth/metadata";

export const metadata = privateRobotsMetadata;
export const dynamic = "force-dynamic";

export default async function WalletLayout({ children }: { children: React.ReactNode }) {
  await requireAuth("/wallet");
  return (
    <>
      <AuthClientGuard mode="auth" />
      {children}
    </>
  );
}
