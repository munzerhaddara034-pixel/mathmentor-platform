/**
 * Minimal Agent Hub list of WhatsApp files (received + sent by Mohammad). Server component.
 */
import { listMediaRecords, type WhatsAppMediaRecord } from "@/lib/whatsapp/media/store";
import { formatMegabytes } from "@/lib/whatsapp/media/policy";
import { INTL_LOCALE, type Locale } from "@/lib/i18n/config";
import { agentMessages } from "@/lib/i18n/ns/agent";
import { rich } from "@/lib/i18n/rich";
import { getI18n } from "@/lib/i18n/server";

function whenLabel(iso: string, locale: Locale): string {
  try {
    return new Date(iso).toLocaleString(INTL_LOCALE[locale], { timeZone: "Asia/Beirut", dateStyle: "short", timeStyle: "short" });
  } catch {
    return iso;
  }
}

function Row({ file, locale }: { file: WhatsAppMediaRecord; locale: Locale }) {
  const who = file.direction === "inbound" ? `← ${file.from ?? "?"}` : `→ ${file.to ?? "?"}`;
  return (
    <tr>
      <td>{whenLabel(file.createdAt, locale)}</td>
      <td>{who}</td>
      <td>{file.kind}</td>
      <td>
        {file.storedName ? (
          <a href={`/api/agent/whatsapp-media/files/${file.id}`} target="_blank" rel="noreferrer">
            {file.filename}
          </a>
        ) : (
          file.filename
        )}
      </td>
      <td>{formatMegabytes(file.sizeBytes)} MB</td>
      <td>
        {file.status}
        {file.action ? ` · ${file.action}` : ""}
      </td>
      <td dir="auto">{(file.caption || file.note || "").slice(0, 80)}</td>
    </tr>
  );
}

export async function WhatsAppMediaList() {
  const files = await listMediaRecords(40);
  const { locale } = await getI18n();
  const t = agentMessages[locale].media;
  return (
    <section className="card agent-panel">
      <h2>{t.title}</h2>
      <p className="muted">{rich(t.lead, { path: <code dir="ltr">data/whatsapp-media/</code> })}</p>
      {files.length === 0 ? (
        <p className="muted">{t.none}</p>
      ) : (
        <table className="agent-table">
          <thead>
            <tr>
              <th>{t.when}</th>
              <th>{t.who}</th>
              <th>{t.kind}</th>
              <th>{t.file}</th>
              <th>{t.size}</th>
              <th>{t.status}</th>
              <th>{t.caption}</th>
            </tr>
          </thead>
          <tbody>
            {files.map((file) => (
              <Row key={file.id} file={file} locale={locale} />
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
