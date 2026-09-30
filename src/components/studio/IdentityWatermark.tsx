"use client";

import { useEffect, useState } from "react";
import { watermarkDate, watermarkText } from "@/lib/videoSecurity";
import { useI18n } from "@/components/i18n/I18nProvider";

export function IdentityWatermark({
  name,
  phone,
  variant = "dark",
}: {
  name: string;
  phone: string;
  variant?: "dark" | "light";
}) {
  const { m } = useI18n();
  const [day, setDay] = useState(watermarkDate);
  useEffect(() => {
    const tick = window.setInterval(() => setDay(watermarkDate()), 60_000);
    return () => window.clearInterval(tick);
  }, []);
  const text = watermarkText(name || m.result.watermarkGuest, phone || "76532421", day);
  return (
    <div className={`identity-watermark ${variant}`} aria-hidden>
      <span className="dynamic-watermark">{text}</span>
      <span className="dynamic-watermark delay">{text}</span>
      <span className="dynamic-watermark diagonal">{text}</span>
    </div>
  );
}

export function PageWatermark({ name, phone }: { name?: string; phone?: string }) {
  return (
    <div className="page-watermark" aria-hidden>
      <IdentityWatermark name={name ?? ""} phone={phone || "76532421"} variant="light" />
    </div>
  );
}
