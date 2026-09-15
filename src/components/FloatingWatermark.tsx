"use client";

export function FloatingWatermark({ text }: { text: string }) {
  if (!text.trim()) return null;
  return (
    <>
      <span className="dynamic-watermark">{text}</span>
      <span className="dynamic-watermark delay">{text}</span>
      <span className="dynamic-watermark delay-2">{text}</span>
    </>
  );
}
