import Link from "next/link";

/** «منذر حداره» shown together with MathMentor. */
export function BrandMark({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="mm-brand" aria-label="منذر حداره · MathMentor">
      <img className="mm-brand-logo" src="/brand/mathmentor-logo.svg" alt="" width={40} height={40} />
      <span className="mm-brand-text">
        <span className="mm-brand-name">منذر حداره</span>
        <bdi dir="ltr" className="mm-brand-sub">
          MathMentor
        </bdi>
      </span>
    </Link>
  );
}
