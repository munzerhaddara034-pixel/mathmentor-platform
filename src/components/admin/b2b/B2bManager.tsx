import { PricingStudyTable } from "./PricingStudyTable";
import { SchoolProposalGenerator } from "./SchoolProposalGenerator";
import { WhishOpsPanel } from "./WhishOpsPanel";

export function B2bManager({
  walletPhone,
  walletNameAr,
}: {
  walletPhone: string;
  walletNameAr: string;
}) {
  return (
    <div className="b2b-manager mm-mobile-stack">
      <SchoolProposalGenerator />
      <WhishOpsPanel wallet={{ phone: walletPhone, nameAr: walletNameAr }} />
      <PricingStudyTable />
    </div>
  );
}
