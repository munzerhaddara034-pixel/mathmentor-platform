import { FeatureTiles } from "@/components/home/FeatureTiles";
import { HomeHero } from "@/components/home/HomeHero";
import { HowItWorks } from "@/components/home/HowItWorks";
import { LivePriceCard } from "@/components/home/LivePriceCard";
import { getSession } from "@/lib/auth/server";
import { dualLiveSessionPrices } from "@/lib/whish/client";
import "@/styles/home.css";

export default async function HomePage() {
  const user = await getSession();
  const prices = dualLiveSessionPrices();
  return (
    <main className="shell mm-home">
      <HomeHero signedIn={Boolean(user)} />
      <FeatureTiles />
      <HowItWorks />
      {prices.member.amount > 0 && prices.external.amount > 0 ? (
        <LivePriceCard memberAmount={prices.member.amount} externalAmount={prices.external.amount} />
      ) : null}
    </main>
  );
}
