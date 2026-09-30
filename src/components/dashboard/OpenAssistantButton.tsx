"use client";

import { OPEN_ASSISTANT_EVENT } from "@/components/ChatWidget";

export function OpenAssistantButton({ label }: { label: string }) {
  return (
    <button type="button" className="v2-btn v2-btn-glass" onClick={() => window.dispatchEvent(new Event(OPEN_ASSISTANT_EVENT))}>
      {label}
    </button>
  );
}
