"use client";

import { useEffect, useRef, useState } from "react";

export type RecordedClip = {
  blob: Blob;
  url: string;
  mimeType: string;
  durationSec: number;
};

type Props = {
  onClip: (clip: RecordedClip | null) => void;
  disabled?: boolean;
};

function pickMimeType() {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"];
  if (typeof MediaRecorder === "undefined") return "";
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || "";
}

export function VoiceRecorder({ onClip, disabled }: Props) {
  const [supported, setSupported] = useState(true);
  const [permissionError, setPermissionError] = useState("");
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [clip, setClip] = useState<RecordedClip | null>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const startedAt = useRef(0);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    setSupported(typeof window !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia) && typeof MediaRecorder !== "undefined");
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const stopTimer = () => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const start = async () => {
    setPermissionError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = pickMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const type = recorder.mimeType || mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type });
        const durationSec = Math.max(0.5, (Date.now() - startedAt.current) / 1000);
        const url = URL.createObjectURL(blob);
        const next: RecordedClip = { blob, url, mimeType: type, durationSec };
        setClip((prev) => {
          if (prev?.url) URL.revokeObjectURL(prev.url);
          return next;
        });
        onClip(next);
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      };
      mediaRef.current = recorder;
      startedAt.current = Date.now();
      setElapsed(0);
      recorder.start(200);
      setRecording(true);
      timerRef.current = window.setInterval(() => {
        setElapsed((Date.now() - startedAt.current) / 1000);
      }, 200);
    } catch (error) {
      setPermissionError(
        error instanceof Error ? error.message : "Microphone permission denied.",
      );
    }
  };

  const stop = () => {
    stopTimer();
    if (mediaRef.current && mediaRef.current.state !== "inactive") mediaRef.current.stop();
    setRecording(false);
  };

  const clear = () => {
    if (clip?.url) URL.revokeObjectURL(clip.url);
    setClip(null);
    onClip(null);
    setElapsed(0);
  };

  return (
    <section className="voice-recorder card" aria-label="تسجيل الشرح الصوتي / Record explanation">
      <p className="eyebrow">تسجيل الشرح الصوتي / Record explanation</p>
      <h2>الموظف الذكي للشرح الصوتي</h2>
      <p className="muted">
        Prof. Munzer Haddara / الأستاذ منذر حداره · MathMentor · أكاديمية منذر حداره
      </p>
      {!supported ? (
        <p className="error">This browser cannot record audio. Use Chrome/Firefox, or tap a demo dictation below.</p>
      ) : null}
      {permissionError ? <p className="error">{permissionError}</p> : null}
      <div className="voice-recorder-actions">
        <button
          type="button"
          className={`voice-mic ${recording ? "recording" : ""}`}
          disabled={disabled || !supported || recording}
          onClick={() => void start()}
          aria-pressed={recording}
        >
          <span className="voice-mic-icon" aria-hidden>
            ●
          </span>
          <span>
            {recording ? "جارٍ التسجيل…" : "تسجيل الشرح الصوتي"}
            <small>Record explanation</small>
          </span>
        </button>
        {recording ? (
          <button className="btn warn" type="button" onClick={stop}>
            إيقاف / Stop · {elapsed.toFixed(1)}s
          </button>
        ) : null}
        {clip && !recording ? (
          <button className="btn" type="button" onClick={clear} disabled={disabled}>
            مسح التسجيل / Clear
          </button>
        ) : null}
      </div>
      {recording ? (
        <p className="voice-pulse" role="status">
          Recording… {elapsed.toFixed(1)}s
        </p>
      ) : null}
      {clip ? (
        <div className="voice-preview">
          <p className="muted">
            Preview · {clip.mimeType} · {clip.durationSec.toFixed(1)}s
          </p>
          <audio controls src={clip.url} />
        </div>
      ) : (
        <p className="muted">Record in the browser (MediaRecorder → webm/wav), then solve — or use a demo transcript without a microphone.</p>
      )}
    </section>
  );
}
