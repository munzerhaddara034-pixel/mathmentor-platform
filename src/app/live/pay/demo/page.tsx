import Link from "next/link";

export default function LivePayDemoRedirectPage() {
  return (
    <main className="shell mm-mobile-stack">
      <p className="eyebrow">Whish · MathMentor</p>
      <h1>الدفع اليدوي من صفحة الحجز</h1>
      <p className="muted">
        Whish merchant checkout is not used. Transfer instructions and “I&apos;ve transferred” live on{" "}
        <Link href="/live">/live</Link>.
      </p>
      <p>
        <Link className="btn dark" href="/live">
          العودة إلى /live
        </Link>
      </p>
    </main>
  );
}
