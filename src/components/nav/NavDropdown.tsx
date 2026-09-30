"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";
import { useDismiss } from "./useDismiss";

/** Accessible disclosure menu used for «المزيد» and the account menu. */
export function NavDropdown({
  label,
  children,
  className,
  buttonClassName,
  align = "end",
}: {
  label: ReactNode;
  children: (close: () => void) => ReactNode;
  className?: string;
  buttonClassName?: string;
  align?: "start" | "end";
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(box, open, close);
  return (
    <div className={`mm-dropdown${className ? ` ${className}` : ""}`} ref={box}>
      <button
        type="button"
        className={`mm-dropdown-btn${buttonClassName ? ` ${buttonClassName}` : ""}`}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
      >
        {label}
        <Icon name="chevron" size={16} className={open ? "mm-rot" : undefined} />
      </button>
      {open ? (
        <div className={`mm-dropdown-panel mm-align-${align}`} role="menu">
          {children(close)}
        </div>
      ) : null}
    </div>
  );
}
