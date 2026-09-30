"use client";

import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { isActivePath, type NavItem } from "./navConfig";

/** Vertical list of links inside a dropdown or the mobile sheet. */
export function MenuLinks({ items, pathname, onNavigate }: { items: NavItem[]; pathname: string; onNavigate: () => void }) {
  return (
    <ul className="mm-menu-links">
      {items.map((item) => (
        <li key={item.href}>
          <Link
            href={item.href}
            role="menuitem"
            className={isActivePath(pathname, item.href) ? "active" : undefined}
            aria-current={isActivePath(pathname, item.href) ? "page" : undefined}
            onClick={onNavigate}
          >
            {item.icon ? <Icon name={item.icon} size={20} /> : <span className="mm-menu-dot" aria-hidden />}
            {item.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}
