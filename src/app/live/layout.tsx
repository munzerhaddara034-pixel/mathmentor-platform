import { privateRobotsMetadata } from "@/lib/auth/metadata";

export const metadata = privateRobotsMetadata;
export const dynamic = "force-dynamic";

/** Booking page is public (guest $25 / member $15). Classroom stays gated below. */
export default function LiveLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
