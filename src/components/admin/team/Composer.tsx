"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { AgentVoiceRecorder, type AgentVoiceClip } from "@/components/admin/agent/AgentVoiceRecorder";
import { transcribeVoice } from "./teamApi";

type Props = {
  disabled: boolean;
  placeholder: string;
  onSend: (text: string, files: File[]) => Promise<boolean>;
};

const MAX_FILES = 4;
const MAX_BYTES = 8 * 1024 * 1024;
const ACCEPT = "image/*,application/pdf,.txt,.csv,.md,.docx,.xlsx";

/** Text + voice (Whisper → Gemini fallback) + file/image attach. Enter = send, Shift+Enter = new line. */
export function Composer({ disabled, placeholder, onSend }: Props) {
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [voiceBusy, setVoiceBusy] = useState(false);
  const [hint, setHint] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const next = [...files];
    for (const file of Array.from(list)) {
      if (next.length >= MAX_FILES) {
        setHint(`حدّ أقصى ${MAX_FILES} مرفقات.`);
        break;
      }
      if (file.size > MAX_BYTES) {
        setHint(`${file.name} أكبر من 8MB.`);
        continue;
      }
      next.push(file);
    }
    setFiles(next);
    if (inputRef.current) inputRef.current.value = "";
  };

  const submit = async () => {
    if (disabled || (!text.trim() && !files.length)) return;
    const ok = await onSend(text, files);
    if (ok) {
      setText("");
      setFiles([]);
      setHint("");
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void submit();
    }
  };

  const onVoice = async (clip: AgentVoiceClip) => {
    setVoiceBusy(true);
    setHint("جارٍ تفريغ التسجيل الصوتي…");
    const result = await transcribeVoice(clip.blob, clip.filename);
    setVoiceBusy(false);
    if (!result.ok) {
      setHint(result.errorAr);
      return;
    }
    setText((current) => (current.trim() ? `${current.trim()}\n${result.data.text}` : result.data.text));
    setHint("تم التفريغ — راجع النص ثم أرسل.");
  };

  return (
    <div className="team-composer">
      {files.length ? (
        <ul className="team-file-chips" aria-label="المرفقات">
          {files.map((file, index) => (
            <li key={`${file.name}-${index}`}>
              <span>📎 {file.name}</span>
              <button
                type="button"
                aria-label={`إزالة ${file.name}`}
                onClick={() => setFiles(files.filter((_, i) => i !== index))}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {hint ? (
        <p className="team-composer-hint" role="status">
          {hint}
        </p>
      ) : null}
      <div className="team-composer-row">
        <button
          type="button"
          className="team-icon-btn"
          aria-label="إرفاق ملف أو صورة"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
        >
          📎
        </button>
        <input ref={inputRef} type="file" hidden multiple accept={ACCEPT} onChange={(event) => addFiles(event.target.files)} />
        <textarea
          className="team-textarea"
          dir="auto"
          rows={1}
          value={text}
          placeholder={placeholder}
          disabled={disabled}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={onKeyDown}
          aria-label="نص الرسالة"
        />
        <button
          type="button"
          className="btn team-send"
          disabled={disabled || (!text.trim() && !files.length)}
          onClick={() => void submit()}
        >
          إرسال
        </button>
      </div>
      <div className="team-voice">
        <AgentVoiceRecorder disabled={disabled || voiceBusy} onRecorded={(clip) => void onVoice(clip)} />
      </div>
    </div>
  );
}
