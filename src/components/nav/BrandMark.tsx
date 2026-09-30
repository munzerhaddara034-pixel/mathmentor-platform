"use client";

import Link from "next/link";
import { useI18n } from "@/components/i18n/I18nProvider";

/** «منذر حداره» (ar) / "Munzer Haddara" (en, fr) always shown together with MathMentor. */
export function BrandMark({ href = "/" }: { href?: string }) {
  const { m } = useI18n();
  return (
    <Link href={href} className="mm-brand" aria-label={m.brand.aria}>
      <img className="mm-brand-logo" src="/brand/mathmentor-logo.svg" alt="" width={40} height={40} />
      <span className="mm-brand-text">
        <span className="mm-brand-name">{m.brand.name}</span>
        <bdi dir="ltr" className="mm-brand-sub">
          {m.brand.sub}
        </bdi>
      </span>
    </Link>
  );
}
