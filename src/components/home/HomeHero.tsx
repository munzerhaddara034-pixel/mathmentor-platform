import Image from "next/image";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { Ltr } from "@/components/ui/Ltr";
import { MathInline } from "@/components/ui/MathInline";

export function HomeHero({ signedIn }: { signedIn: boolean }) {
  return (
    <section className="mm-hero">
      <div className="mm-hero-copy">
        <span className="mm-chip">للشهادة المتوسطة والثانوية العامة · لبنان</span>
        <h1>
          افهم الرياضيات،
          <br />
          <span className="mm-hero-accent">وانجح بثقة.</span>
        </h1>
        <p className="mm-hero-lead">
          دروس مصوّرة مع سبورة تفاعلية، حلّال مسائل يشرح خطوة بخطوة وفق سلّم العلامات، وحصص مباشرة مع الأستاذ منذر
          حداره.
        </p>
        <div className="mm-hero-cta">
          {signedIn ? (
            <>
              <Link href="/dashboard" className="btn dark mm-btn-lg">
                افتح لوحتي <Icon name="arrow" size={20} />
              </Link>
              <Link href="/math-solver" className="ghost-btn ink mm-btn-lg">
                <Icon name="camera" size={20} /> حلّ مسألة
              </Link>
            </>
          ) : (
            <>
              <Link href="/signup" className="btn dark mm-btn-lg">
                ابدأ مجاناً <Icon name="arrow" size={20} />
              </Link>
              <Link href="/live" className="ghost-btn ink mm-btn-lg">
                <Icon name="video" size={20} /> احجز حصة مباشرة
              </Link>
            </>
          )}
        </div>
        <ul className="mm-hero-checks">
          <li>
            <Icon name="check" size={18} /> المنهج اللبناني الرسمي
          </li>
          <li>
            <Icon name="check" size={18} /> <Ltr>Brevet · LS · GS · SE</Ltr>
          </li>
          <li>
            <Icon name="check" size={18} /> عربي · <Ltr>English</Ltr> · <Ltr>Français</Ltr>
          </li>
        </ul>
      </div>
      <figure className="mm-hero-photo">
        <Image
          src="/teachers/munzer.jpg"
          alt="الأستاذ منذر حداره أمام اللوح"
          width={864}
          height={1152}
          priority
          sizes="(max-width: 959px) 100vw, 520px"
        />
        <span className="mm-hero-eq">
          <MathInline tex="f(x)=(x-1)e^{x}\;\Rightarrow\;f'(x)=x\,e^{x}" />
        </span>
        <figcaption className="mm-hero-tag">
          <strong>الأستاذ منذر حداره</strong>
          <span>
            أستاذ رياضيات · <Ltr>Brevet · Terminale</Ltr>
          </span>
        </figcaption>
      </figure>
    </section>
  );
}
