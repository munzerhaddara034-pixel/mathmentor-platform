"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { SkeletonBlock } from "@/components/ui/Skeleton";

function FailureInner() {
  const params = useSearchParams();
  const bookingId = params.get("booking") || "";
  return (
    <main className="shell mm-mobile-stack">
      <p className="eyebrow">MathMentor · أكاديمية منذر حداره</p>
      <h1>فشل الدفع / Payment failed</h1>
      <p className="muted">
        The live booking was not confirmed. You can try again from /live.
      </p>
      <div className="card">
        {bookingId ? <p className="muted">Booking: {bookingId}</p> : null}
        <a className="btn dark" href="/live">
          Back to booking · العودة للحجز
        </a>
      </div>
    </main>
  );
}

export default function PayFailurePage() {
  return (
    <Suspense fallback={<main className="shell"><SkeletonBlock lines={3} label="Loading" /></main>}>
      <FailureInner />
    </Suspense>
  );
}
