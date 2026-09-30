"use client";

import Link from "next/link";
import type { SessionUser } from "@/lib/auth/types";
import { Icon } from "@/components/ui/Icon";
import { useI18n } from "@/components/i18n/I18nProvider";
import { isActivePath, tabsFor } from "./navConfig";

/** Mobile-only bottom navigation with the central «حلّ مسألة» action. */
export function MobileTabBar({ user, pathname }: { user: SessionUser | null; pathname: string }) {
  const { m } = useI18n();
  const tabs = tabsFor(user, m.nav);
  return (
    <nav className="mm-tabbar" aria-label={m.nav.bottom}>
      {tabs.map((tab, index) => {
        const active = isActivePath(pathname, tab.href);
        const central = index === 2;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`mm-tab${active ? " active" : ""}${central ? " central" : ""}`}
            aria-current={active ? "page" : undefined}
          >
            {central ? (
              <span className="mm-tab-bubble">
                <Icon name="spark" size={26} />
              </span>
            ) : (
              <Icon name={tab.icon ?? "home"} />
            )}
            <span>{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
