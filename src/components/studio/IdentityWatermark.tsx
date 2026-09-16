"use client";

import { watermarkText } from "@/lib/videoSecurity";

export function IdentityWatermark({
  name,
  phone,
  variant = "dark",
}: {
  name: string;
  phone: string;
  variant?: "dark" | "light";
}) {
  const text = watermarkText(name || "طالب المنصة", phone || "76532421");
  return (
    <div className={`identity-watermark ${variant}`} aria-hidden>
      <span className="dynamic-watermark">{text}</span>
      <span className="dynamic-watermark delay">{text}</span>
      <span className="dynamic-watermark diagonal">{text}</span>
    </div>
  );
}
