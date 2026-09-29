"use client";

import { useEffect, useRef, useState } from "react";
import type { AppNotification } from "@/lib/notifications/store";

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<AppNotification[]>([]);
  const box = useRef<HTMLDivElement>(null);

  const load = () => {
    void fetch("/api/notifications", { credentials: "same-origin" })
      .then((response) => response.json())
      .then((payload: { notifications?: AppNotification[]; unread?: number }) => {
        setItems(payload.notifications ?? []);
        setUnread(payload.unread ?? 0);
      })
      .catch(() => undefined);
  };

  useEffect(() => {
    load();
    const timer = window.setInterval(load, 45_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (box.current && !box.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const openItem = async (item: AppNotification) => {
    if (!item.read) {
      await fetch(`/api/notifications/${item.id}`, { method: "PATCH", credentials: "same-origin" });
    }
    setOpen(false);
    window.location.assign(item.href || "/");
  };

  const readAll = async () => {
    await fetch("/api/notifications", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "read-all" }),
    });
    load();
  };

  return (
    <div className="notif-bell" ref={box}>
      <button type="button" className="notif-bell-btn" onClick={() => setOpen((value) => !value)} aria-label="Notifications">
        🔔
        {unread > 0 ? <span className="notif-badge">{unread > 9 ? "9+" : unread}</span> : null}
      </button>
      {open ? (
        <div className="notif-dropdown">
          <header>
            <strong>التنبيهات / Alerts</strong>
            <button type="button" className="ghost" onClick={() => void readAll()}>
              تعليم الكل مقروء
            </button>
          </header>
          {items.length === 0 ? <p className="muted">لا تنبيهات بعد. / No notifications yet.</p> : null}
          <ul>
            {items.slice(0, 8).map((item) => (
              <li key={item.id}>
                <button type="button" className={item.read ? "read" : "unread"} onClick={() => void openItem(item)}>
                  <strong>
                    {item.titleAr} / {item.title}
                  </strong>
                  <span>{item.bodyAr}</span>
                  <span className="muted">
                    {item.body}
                    {item.createdAt
                      ? ` · ${new Intl.DateTimeFormat("en-GB", {
                          timeZone: "Asia/Beirut",
                          dateStyle: "short",
                          timeStyle: "short",
                          hourCycle: "h23",
                        }).format(new Date(item.createdAt))}`
                      : ""}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
