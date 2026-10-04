import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth/guards";
import { isVerifiedAdmin } from "@/lib/payments/http";
import { PaymentsReview } from "@/components/payments/PaymentsReview";

export const dynamic = "force-dynamic";

/** Admin-only (verified e-mail). The /admin layout lets teachers in, so check again here. */
export default async function AdminPaymentsPage() {
  const live = await requireStaff("/admin/payments");
  if (!isVerifiedAdmin(live.user)) redirect("/admin");
  return <PaymentsReview />;
}
