"use client";

import { roleLabel, type SessionUser } from "@/lib/auth/types";
import { Icon } from "@/components/ui/Icon";
import { NavDropdown } from "./NavDropdown";
import { MenuLinks } from "./MenuLinks";
import { MenuSettings } from "./MenuSettings";
import type { NavItem } from "./navConfig";

export function AccountMenu({
  user,
  items,
  pathname,
  onLogout,
}: {
  user: SessionUser;
  items: NavItem[];
  pathname: string;
  onLogout: () => void;
}) {
  const initial = user.name.trim().charAt(0) || "؟";
  return (
    <NavDropdown
      className="mm-account"
      buttonClassName="mm-account-btn"
      label={
        <>
          <span className="mm-avatar" aria-hidden>
            {initial}
          </span>
          <span className="mm-account-name">{user.name}</span>
        </>
      }
    >
      {(close) => (
        <>
          <div className="mm-account-head">
            <strong>{user.name}</strong>
            <span className="role-badge">{roleLabel(user.role)}</span>
          </div>
          <MenuLinks items={items} pathname={pathname} onNavigate={close} />
          <MenuSettings />
          <button
            type="button"
            className="mm-menu-logout"
            onClick={() => {
              close();
              onLogout();
            }}
          >
            <Icon name="arrow" size={20} />
            تسجيل الخروج
          </button>
        </>
      )}
    </NavDropdown>
  );
}
