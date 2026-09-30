"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { SkeletonBlock } from "@/components/ui/Skeleton";
import { useNs } from "@/components/i18n/useNs";
import { liveMessages } from "@/lib/i18n/ns/live";

function FailureInner() {
  const t = useNs(liveMessages).pay;
  const params = useSearchParams();
  const bookingId = params.get("booking") || "";
  return (
    <main className="shell mm-mobile-stack">
      <p className="eyebrow">{t.brand}</p>
      <h1>{t.failedTitle}</h1>
      <p className="muted">{t.failedLead}</p>
      <div className="card">
        {bookingId ? <p className="muted">{t.booking}: <bdi dir="ltr">{bookingId}</bdi></p> : null}
        <a className="btn dark" href="/live">
          {t.backToLive}
        </a>
      </div>
    </main>
  );
}

export default function PayFailurePage() {
  return (
    <Suspense fallback={<main className="shell"><SkeletonBlock lines={3} /></main>}>
      <FailureInner />
    </Suspense>
  );
}
