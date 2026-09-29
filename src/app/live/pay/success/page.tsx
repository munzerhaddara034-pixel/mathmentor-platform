"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { SkeletonBlock } from "@/components/ui/Skeleton";

function SuccessInner() {
  const params = useSearchParams();
  const bookingId = params.get("booking") || "";
  return (
    <main className="shell mm-mobile-stack">
      <p className="eyebrow">MathMentor · أكاديمية منذر حداره</p>
      <h1>تم الدفع / Payment successful</h1>
      <p className="muted">
        Your live session with Prof. Munzer Ahmad Haddara / الأستاذ منذر أحمد حداره is confirmed.
        WhatsApp was notified when payment cleared.
      </p>
      <div className="card">
        {bookingId ? <p>Booking id: {bookingId}</p> : null}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 12 }}>
          <a className="btn dark" href="/live">
            Open calendar · الرزنامة
          </a>
          {bookingId ? (
            <a className="btn" href={`/live/classroom/${encodeURIComponent(bookingId)}`}>
              انضم للحصة
            </a>
          ) : null}
        </div>
      </div>
    </main>
  );
}

export default function PaySuccessPage() {
  return (
    <Suspense fallback={<main className="shell"><SkeletonBlock lines={3} label="Loading" /></main>}>
      <SuccessInner />
    </Suspense>
  );
}
