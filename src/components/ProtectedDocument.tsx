"use client";

import { useEffect } from "react";

export function ProtectedDocument({
  watermark,
  children,
}: {
  watermark: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const block = (event: Event) => event.preventDefault();
    document.addEventListener("contextmenu", block);
    return () => document.removeEventListener("contextmenu", block);
  }, []);
  return (
    <div className="protected-doc">
      {children}
      <span className="doc-watermark">{watermark}</span>
      <span className="doc-watermark alt">{watermark}</span>
    </div>
  );
}
