import { getI18n } from "@/lib/i18n/server";

export default async function Loading() {
  const { m } = await getI18n();
  return (
    <main className="shell" aria-busy="true">
      {m.common.openingDashboard}
    </main>
  );
}
