"use client";

import { useNs } from "@/components/i18n/useNs";
import { useI18n } from "@/components/i18n/I18nProvider";
import { fmt } from "@/lib/i18n/format";
import { teamMessages } from "@/lib/i18n/ns/team";
import { beirutTime } from "./hamzaFormat";

type Props = {
  issued: { code: string; expiresAt: string } | null;
  active?: { expiresAt: string; issuedTo: string };
  value: string;
  onChange: (value: string) => void;
};

/** Shows the one-time code (only right after issuing) and the field where the approver types it. */
export function ApprovalCodeBox({ issued, active, value, onChange }: Props) {
  const t = useNs(teamMessages).hamza;
  const { locale } = useI18n();
  return (
    <div className="team-code-box">
      {issued ? (
        <p className="team-hint">
          {fmt(t.codeIntro, { time: beirutTime(issued.expiresAt, locale) })}{" "}
          <code className="team-code" dir="ltr">
            {issued.code}
          </code>
        </p>
      ) : active ? (
        <p className="team-hint">{fmt(t.codeActive, { email: active.issuedTo, time: beirutTime(active.expiresAt, locale) })}</p>
      ) : null}
      <label className="team-field">
        {t.codeLabel}
        <input
          className="team-input team-code-input"
          dir="ltr"
          inputMode="text"
          autoComplete="one-time-code"
          autoCapitalize="characters"
          placeholder={t.codePlaceholder}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      </label>
    </div>
  );
}
