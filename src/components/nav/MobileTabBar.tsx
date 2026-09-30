"use client";

import Link from "next/link";
import type { SessionUser } from "@/lib/auth/types";
import { Icon } from "@/components/ui/Icon";
import { isActivePath, tabsFor } from "./navConfig";

/** Mobile-only bottom navigation with the central «حلّ مسألة» action. */
export function MobileTabBar({ user, pathname }: { user: SessionUser | null; pathname: string }) {
  const tabs = tabsFor(user);
  return (
    <nav className="mm-tabbar" aria-label="التنقل السفلي">
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
                <Icon name={tab.icon ?? "camera"} />
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
