"use client";

import type { TeamAttachmentRef } from "@/lib/team/types";
import { attachmentUrl } from "./teamApi";
import { useNs } from "@/components/i18n/useNs";
import { teamMessages } from "@/lib/i18n/ns/team";

function kb(bytes: number) {
  return bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)}MB` : `${Math.max(1, Math.round(bytes / 1024))}KB`;
}

export function AttachmentView({ attachment }: { attachment: TeamAttachmentRef }) {
  const t = useNs(teamMessages);
  const url = attachmentUrl(attachment.id);
  if (attachment.mimeType.startsWith("image/")) {
    return (
      <a className="team-attachment-image" href={url} target="_blank" rel="noreferrer">
        {/* eslint-disable-next-line @next/next/no-img-element -- private, auth-gated attachment */}
        <img src={url} alt={attachment.origin === "generated" ? t.generatedPreview : attachment.name} loading="lazy" />
      </a>
    );
  }
  return (
    <a className="team-attachment-file" href={url} target="_blank" rel="noreferrer">
      📎 {attachment.name} <span className="muted">· {kb(attachment.sizeBytes)}</span>
    </a>
  );
}
