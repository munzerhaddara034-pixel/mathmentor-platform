"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { SkeletonBlock } from "@/components/ui/Skeleton";
import { useNs } from "@/components/i18n/useNs";
import { liveMessages } from "@/lib/i18n/ns/live";

function SuccessInner() {
  const t = useNs(liveMessages).pay;
  const params = useSearchParams();
  const bookingId = params.get("booking") || "";
  return (
    <main className="shell mm-mobile-stack">
      <p className="eyebrow">{t.brand}</p>
      <h1>{t.successTitle}</h1>
      <p className="muted">{t.successLead}</p>
      <div className="card">
        {bookingId ? <p>{t.booking}: <bdi dir="ltr">{bookingId}</bdi></p> : null}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 12 }}>
          <a className="btn dark" href="/live">
            {t.openCalendar}
          </a>
          {bookingId ? (
            <a className="btn" href={`/live/classroom/${encodeURIComponent(bookingId)}`}>
              {t.join}
            </a>
          ) : null}
        </div>
      </div>
    </main>
  );
}

export default function PaySuccessPage() {
  return (
    <Suspense fallback={<main className="shell"><SkeletonBlock lines={3} /></main>}>
      <SuccessInner />
    </Suspense>
  );
}
