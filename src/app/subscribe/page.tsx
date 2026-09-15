import { readStore } from "@/lib/store";
import { whatsappLink } from "@/lib/settings";
import Link from "next/link";

export default async function SubscribePage() {
  const store = await readStore();
  const settings = store.settings;
  return (
    <main className="shell">
      <p className="eyebrow">Subscription</p>
      <h1>رسوم الاشتراك ورقم الهاتف</h1>
      <p className="muted">
        Academy phone / WhatsApp: {settings.phone}. The AI employee can change this number by command after you confirm.
      </p>
      <div className="grid two">
        {settings.plans.map((plan) => (
          <article className="card" key={plan.id}>
            <span className="badge">{plan.name}</span>
            <h2>{plan.arabicName}</h2>
            <p style={{ fontSize: 28, margin: "8px 0" }}>${plan.usdMonthly}<span className="muted"> / month</span></p>
            <p className="muted">${plan.usdTerm} per term</p>
            <p>{plan.includes}</p>
            <a className="btn dark" href={whatsappLink(settings.whatsapp, `Subscribe: ${plan.name}`)}>
              دفع إلكتروني / واتساب
            </a>
            <p className="muted" style={{ marginTop: 8 }}>
              بطاقة مصرفية: تُربط لاحقاً (Stripe / local gateway). أو اشترِ بطاقة كشط من مكتب معتمد ثم أدخل كوداً من 12 خانة على حسابك.
            </p>
            <Link className="btn" href="/redeem">
              تفعيل بطاقة كشط
            </Link>
          </article>
        ))}
      </div>
      <div className="row" style={{ marginTop: 24 }}>
        <Link className="btn" href="/classroom">
          Start a classroom video
        </Link>
        <Link className="btn" href="/student">
          Student chat
        </Link>
      </div>
    </main>
  );
}
