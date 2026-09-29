import { AuthClientGuard } from "@/components/auth/AuthClientGuard";
import { requireAiAccess } from "@/lib/auth/guards";
import { privateRobotsMetadata } from "@/lib/auth/metadata";

export const metadata = privateRobotsMetadata;
export const dynamic = "force-dynamic";

export default async function MathSolverLayout({ children }: { children: React.ReactNode }) {
  await requireAiAccess("/math-solver");
  return (
    <>
      <AuthClientGuard mode="ai" />
      {children}
    </>
  );
}
