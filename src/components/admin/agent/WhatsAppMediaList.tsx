/**
 * Minimal Agent Hub list of WhatsApp files (received + sent by محمد). Server component.
 */
import { listMediaRecords, type WhatsAppMediaRecord } from "@/lib/whatsapp/media/store";
import { formatMegabytes } from "@/lib/whatsapp/media/policy";

function whenLabel(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-GB", { timeZone: "Asia/Beirut", dateStyle: "short", timeStyle: "short" });
  } catch {
    return iso;
  }
}

function Row({ file }: { file: WhatsAppMediaRecord }) {
  const who = file.direction === "inbound" ? `← ${file.from ?? "?"}` : `→ ${file.to ?? "?"}`;
  return (
    <tr>
      <td>{whenLabel(file.createdAt)}</td>
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
  return (
    <section className="card agent-panel">
      <h2 dir="rtl" lang="ar">
        ملفات واتساب · WhatsApp files
      </h2>
      <p className="muted">
        Images, PDFs and documents received by محمد, and files he sent. Stored under <code>data/whatsapp-media/</code>{" "}
        (ephemeral on free Render — re-download what you need).
      </p>
      {files.length === 0 ? (
        <p className="muted">No files yet.</p>
      ) : (
        <table className="agent-table">
          <thead>
            <tr>
              <th>When (Beirut)</th>
              <th>Who</th>
              <th>Kind</th>
              <th>File</th>
              <th>Size</th>
              <th>Status</th>
              <th>Caption / note</th>
            </tr>
          </thead>
          <tbody>
            {files.map((file) => (
              <Row key={file.id} file={file} />
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
