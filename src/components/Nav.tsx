"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { SessionUser } from "@/lib/auth/types";
import { Icon } from "@/components/ui/Icon";
import { AccountMenu } from "./nav/AccountMenu";
import { BrandMark } from "./nav/BrandMark";
import { MenuLinks } from "./nav/MenuLinks";
import { MenuSettings } from "./nav/MenuSettings";
import { MobileSheet } from "./nav/MobileSheet";
import { MobileTabBar } from "./nav/MobileTabBar";
import { NavDropdown } from "./nav/NavDropdown";
import { isActivePath, navFor } from "./nav/navConfig";
import { NotificationBell } from "./NotificationBell";

type MeResponse = { user?: SessionUser | null };

/**
 * Light top bar: brand · ~5 links · «المزيد» · account menu.
 * Mobile: brand + bell + menu button, plus the bottom tab bar.
 */
export function Nav({ initialUser }: { initialUser: SessionUser | null }) {
  const pathname = usePathname() || "/";
  const [sheetOpen, setSheetOpen] = useState(false);
  const [user, setUser] = useState(initialUser);
  const model = navFor(user);

  useEffect(() => {
    setUser(initialUser);
  }, [initialUser]);

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      try {
        const response = await fetch("/api/auth/me", { credentials: "include" });
        if (!response.ok) return;
        const payload = (await response.json()) as MeResponse;
        if (!cancelled) setUser(payload.user ?? null);
      } catch {
        /* keep the server-rendered user on network errors */
      }
    };
    void refresh();
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  const closeSheet = useCallback(() => setSheetOpen(false), []);

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
    } catch {
      /* the redirect below still clears the UI */
    }
    setUser(null);
    setSheetOpen(false);
    window.location.assign("/login");
  }, []);

  return (
    <>
      <header className="mm-nav">
        <div className="mm-nav-inner">
          <BrandMark href={user ? "/dashboard" : "/"} />
          <nav className="mm-nav-links" aria-label="التنقل الرئيسي">
            {model.primary.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={isActivePath(pathname, link.href) ? "active" : undefined}
                aria-current={isActivePath(pathname, link.href) ? "page" : undefined}
              >
                {link.label}
              </Link>
            ))}
            <NavDropdown label="المزيد" className="mm-more">
              {(close) => (
                <>
                  <MenuLinks items={model.more} pathname={pathname} onNavigate={close} />
                  {user ? null : <MenuSettings />}
                </>
              )}
            </NavDropdown>
          </nav>
          <div className="mm-nav-end">
            {user ? (
              <>
                <NotificationBell />
                <div className="mm-desktop-only">
                  <AccountMenu user={user} items={model.account} pathname={pathname} onLogout={() => void logout()} />
                </div>
              </>
            ) : (
              <div className="mm-desktop-only mm-guest-actions">
                <Link href="/login" className="ghost-btn ink mm-btn-sm">
                  دخول
                </Link>
                <Link href="/signup" className="btn dark mm-btn-sm">
                  ابدأ مجاناً
                </Link>
              </div>
            )}
            <button
              type="button"
              className="mm-icon-btn mm-mobile-only"
              aria-expanded={sheetOpen}
              aria-label="القائمة"
              onClick={() => setSheetOpen(true)}
            >
              <Icon name="menu" />
            </button>
          </div>
        </div>
      </header>
      <MobileSheet
        open={sheetOpen}
        model={model}
        user={user}
        pathname={pathname}
        onClose={closeSheet}
        onLogout={() => void logout()}
      />
      <MobileTabBar user={user} pathname={pathname} />
    </>
  );
}
