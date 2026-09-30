"use client";

import Link from "next/link";
import { OPEN_ASSISTANT_EVENT } from "@/components/ChatWidget";
import { Icon, type IconName } from "@/components/ui/Icon";

type Action = { href: string; label: string; icon: IconName; tone: string };

const ACTIONS: Action[] = [
  { href: "/math-solver", label: "صوّر مسألة", icon: "camera", tone: "tone-gold" },
  { href: "/practice", label: "بنك الأسئلة", icon: "layers", tone: "tone-navy" },
  { href: "/exams", label: "محاكاة امتحان", icon: "exam", tone: "tone-coral" },
];

export function QuickActions() {
  return (
    <section aria-labelledby="mm-quick">
      <h2 id="mm-quick" className="mm-dash-h2">
        اختصارات
      </h2>
      <div className="mm-quick">
        {ACTIONS.map((action) => (
          <Link key={action.href} href={action.href} className="mm-card mm-quick-item">
            <span className={`mm-tile-icon ${action.tone}`}>
              <Icon name={action.icon} size={22} />
            </span>
            {action.label}
          </Link>
        ))}
        <button
          type="button"
          className="mm-card mm-quick-item"
          onClick={() => window.dispatchEvent(new Event(OPEN_ASSISTANT_EVENT))}
        >
          <span className="mm-tile-icon tone-teal">
            <Icon name="chat" size={22} />
          </span>
          اسأل المساعد
        </button>
      </div>
    </section>
  );
}
