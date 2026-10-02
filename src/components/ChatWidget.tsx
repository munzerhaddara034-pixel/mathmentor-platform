"use client";

import { useState } from "react";

const fileToBase64Helper = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Failed to convert file to base64"));
      }
    };
    reader.onerror = (error) => reject(error);
  });
};

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<{ role: "user" | "bot"; text: string }[]>([
    { role: "bot", text: "أهلاً بك. أنا «مساعد الأستاذ منذر». اسأل عن درس، تمرين، أو طريقة الاشتراك." },
  ]);

  const send = async () => {
    const message = text.trim();
    if (!message && !file) return;

    let fullMessage = message;
    let fileBase64: string | null = null;
    let fileName: string | null = null;

    if (file) {
      fileName = file.name;
      fullMessage = message 
        ? `${message} (مرفق ملف: ${file.name})` 
        : `أرسل ملفاً: ${file.name}`;
      
      try {
        fileBase64 = await fileToBase64Helper(file);
      } catch (err) {
        console.error("Error reading file:", err);
      }
    }

    setText("");
    setFile(null);
    setLog((rows) => [...rows, { role: "user", text: fullMessage }]);
    setBusy(true);

    try {
      const response = await fetch("/api/bot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: fullMessage,
          file: fileBase64 ? { data: fileBase64, name: fileName, type: file?.type } : undefined
        }),
      });
      const data = (await response.json()) as { reply?: string };
      setLog((rows) => [...rows, { role: "bot", text: data.reply ?? "تعذّر الرد. اترك اسمك ورقم 76532421." }]);
    } catch (error) {
      setLog((rows) => [...rows, { role: "bot", text: "حدث خطأ أثناء الاتصال بالخادم. يرجى المحاولة لاحقاً." }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="chat-widget" dir="rtl">
      {open ? (
        <div className="chat-panel">
          <header>
            <strong>مساعد الأستاذ منذر</strong>
            <button type="button" onClick={() => setOpen(false)} aria-label="إغلاق المساعد">
              ×
            </button>
          </header>
          <div className="chat-log">
            {log.map((row, index) => (
              <p key={index} className={row.role}>
                {row.text}
              </p>
            ))}
          </div>
          {file ? (
            <div 
              className="file-preview" 
              style={{ 
                padding: "6px 12px", 
                background: "#f3f4f6", 
                fontSize: "12px", 
                display: "flex", 
                justifyContent: "space-between", 
                alignItems: "center", 
                borderTop: "1px solid #e5e7eb" 
              }} 
            >
              <span style={{ textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap", maxWidth: "200px" }}>
                📎 {file.name} ({ (file.size / 1024).toFixed(1) } KB)
              </span>
              <button 
                type="button" 
                onClick={() => setFile(null)} 
                style={{ 
                  background: "none", 
                  border: "none", 
                  color: "#ef4444", 
                  cursor: "pointer", 
                  fontWeight: "bold" 
                }} 
              >
                إلغاء
              </button>
            </div>
          ) : null}
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void send();
            }}
            style={{ display: "flex", gap: "8px", padding: "8px", alignItems: "center" }}
          >
            <input 
              value={text} 
              onChange={(event) => setText(event.target.value)} 
              placeholder="اكتب سؤالك…" 
              style={{ flex: 1 }} 
            />
            <label 
              style={{ 
                cursor: "pointer", 
                display: "flex", 
                alignItems: "center", 
                justifyContent: "center", 
                padding: "8px", 
                background: "#f3f4f6", 
                borderRadius: "4px",
                fontSize: "16px"
              }} 
              title="إرفاق صورة أو ملف" 
            >
              📎
              <input 
                type="file" 
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    setFile(e.target.files[0]);
                  }
                }} 
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt" 
                style={{ display: "none" }} 
              />
            </label>
            <button className="btn dark" type="submit" disabled={busy || (!text.trim() && !file)}>
              إرسال
            </button>
          </form>
        </div>
      ) : null}
      <button className="chat-fab" type="button" onClick={() => setOpen((value) => !value)}>
        مساعد الأستاذ منذر
      </button>
    </div>
  );
}
