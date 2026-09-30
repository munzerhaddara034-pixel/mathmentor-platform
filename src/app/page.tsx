import { BookingCard } from "@/components/home/v2/BookingCard";
import { DemoConversation } from "@/components/home/v2/DemoConversation";
import { FeatureCards } from "@/components/home/v2/FeatureCards";
import { HomeHeroV2 } from "@/components/home/v2/HomeHeroV2";
import { PlanCards } from "@/components/home/v2/PlanCards";
import { TrackChips } from "@/components/home/v2/TrackChips";
import { getSession } from "@/lib/auth/server";
import { getI18n } from "@/lib/i18n/server";
import { WHISH_NUMBER } from "@/lib/team/constants";
import { dualLiveSessionPrices } from "@/lib/whish/client";
import "@/styles/home.css";

/** Home — redesign-v2 A «أستاذ منذر» / Professor Munzer. Server-rendered; no KaTeX or motion JS. */
export default async function HomePage() {
  const [user, { m, locale }] = await Promise.all([getSession(), getI18n()]);
  const prices = dualLiveSessionPrices();
  const showPrices = prices.member.amount > 0 && prices.external.amount > 0;
  return (
    <main className="shell mm-home v2-home">
      <HomeHeroV2 m={m} signedIn={Boolean(user)} />
      <TrackChips t={m.home} />
      <DemoConversation m={m} />
      <FeatureCards t={m.home} />
      <div className="v2-home-bottom">
        {showPrices ? (
          <BookingCard m={m} locale={locale} prices={{ member: prices.member.amount, guest: prices.external.amount }} whishNumber={WHISH_NUMBER} />
        ) : null}
        <PlanCards m={m} locale={locale} />
      </div>
    </main>
  );
}
