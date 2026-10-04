import { requireAuth } from "@/lib/auth/guards";
import { PaymentClaimForm } from "@/components/payments/PaymentClaimForm";
import { getPaymentSettings, paymentsAvailable, planOptions } from "@/lib/payments/service";
import { DEFAULT_PAYMENT_PERIOD_REGION } from "@/lib/payments/types";

export const dynamic = "force-dynamic";

/** "I paid": the student reports a Whish / OMT transfer. Nothing activates until an admin confirms. */
export default async function WalletPayPage() {
  const live = await requireAuth("/wallet/pay");
  const user = live.user;
  const settings = await getPaymentSettings();
  return (
    <PaymentClaimForm
      canSubmit={user.role === "student" && paymentsAvailable()}
      blockedReason={user.role === "parent" ? "parent" : user.role !== "student" ? "role" : paymentsAvailable() ? null : "unavailable"}
      settings={settings}
      plans={planOptions()}
      defaultRegion={DEFAULT_PAYMENT_PERIOD_REGION}
      prefill={{ name: user.name || "", email: user.email || "", phone: user.contactPhone || "" }}
    />
  );
}
