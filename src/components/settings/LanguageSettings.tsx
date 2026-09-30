"use client";

import { useState } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import { saveLocale } from "@/components/i18n/LocaleSwitcher";
import { LOCALE_LABEL, LOCALES, type Locale } from "@/lib/i18n/config";

type Status = { kind: "idle" } | { kind: "saving" } | { kind: "saved"; toProfile: boolean } | { kind: "error" };

/** Radio list + Save: cookie for this device, and the account profile when it has one (applied at login). */
export function LanguageSettings({ current, profileLocale }: { current: Locale; profileLocale: Locale | null }) {
  const { m } = useI18n();
  const t = m.settings;
  const [selected, setSelected] = useState<Locale>(current);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const saving = status.kind === "saving";

  const save = async () => {
    setStatus({ kind: "saving" });
    const result = await saveLocale(selected);
    if (!result.ok) {
      setStatus({ kind: "error" });
      return;
    }
    setStatus({ kind: "saved", toProfile: result.savedToProfile });
    // Re-render on the server in the new language (lang/dir + strings).
    if (selected !== current) window.setTimeout(() => window.location.reload(), 700);
  };

  return (
    <form
      className="v2-lang-form"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <fieldset disabled={saving}>
        <legend className="sr-only">{t.languageTitle}</legend>
        {LOCALES.map((code) => (
          <label key={code} className={`v2-lang-option${selected === code ? " is-selected" : ""}`}>
            <input type="radio" name="locale" value={code} checked={selected === code} onChange={() => setSelected(code)} />
            <span>
              <bdi lang={code}>{LOCALE_LABEL[code]}</bdi>
            </span>
            {code === current ? <small>{t.current}</small> : null}
          </label>
        ))}
      </fieldset>
      <div className="v2-lang-actions">
        <button type="submit" className="v2-btn v2-btn-primary" disabled={saving || (selected === current && profileLocale === current)} aria-busy={saving}>
          {saving ? t.saving : t.save}
        </button>
        <p className="v2-small" role="status" aria-live="polite">
          {status.kind === "saved" ? (status.toProfile ? t.savedProfile : t.savedCookie) : null}
        </p>
        {status.kind === "error" ? (
          <p className="mm-widget-error" role="alert">
            {t.failed}
          </p>
        ) : null}
      </div>
    </form>
  );
}
