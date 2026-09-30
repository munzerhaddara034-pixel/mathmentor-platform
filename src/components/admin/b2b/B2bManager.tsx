import { PricingStudyTable } from "./PricingStudyTable";
import { SchoolProposalGenerator } from "./SchoolProposalGenerator";
import { WhishOpsPanel } from "./WhishOpsPanel";
import { getI18n } from "@/lib/i18n/server";

export async function B2bManager({
  walletPhone,
  walletNameAr,
}: {
  walletPhone: string;
  walletNameAr: string;
}) {
  const { locale } = await getI18n();
  return (
    <div className="b2b-manager mm-mobile-stack">
      <SchoolProposalGenerator />
      <WhishOpsPanel wallet={{ phone: walletPhone, nameAr: walletNameAr }} />
      <PricingStudyTable locale={locale} />
    </div>
  );
}
