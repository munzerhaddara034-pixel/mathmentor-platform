"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { permissionErrorFromUnknown } from "@/lib/media/permissionCopy";

export type AgentVoiceClip = {
  blob: Blob;
  mimeType: string;
  filename: string;
  durationSec: number;
};

type Props = {
  disabled?: boolean;
  onRecorded: (clip: AgentVoiceClip) => void;
};

const MIME_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/wav",
] as const;

function pickMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  return MIME_CANDIDATES.find((type) => MediaRecorder.isTypeSupported(type)) || "";
}

function extensionForMime(mimeType: string): string {
  if (mimeType.includes("mp4") || mimeType.includes("m4a")) return "m4a";
  if (mimeType.includes("wav")) return "wav";
  if (mimeType.includes("ogg")) return "ogg";
  return "webm";
}

function formatTimer(totalSec: number): string {
  const sec = Math.max(0, Math.floor(totalSec));
  const mm = String(Math.floor(sec / 60)).padStart(2, "0");
  const ss = String(sec % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

/**
 * In-browser mic recorder for Agent Hub Voice Memo Simulator.
 * Brand: Prof. Munzer Haddara / الأستاذ منذر حداره.
 */
export function AgentVoiceRecorder({ disabled, onRecorded }: Props) {
  const [supported, setSupported] = useState(true);
  const [recording, setRecording] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [permissionErrorAr, setPermissionErrorAr] = useState("");
  const [permissionHintAr, setPermissionHintAr] = useState("");

  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const startedAtRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const cancelRef = useRef(false);
  const mimeRef = useRef("");

  const clearTimer = useCallback(() => {
    if (timerRef.current != null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const releaseStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    setSupported(
      typeof window !== "undefined" &&
        Boolean(navigator.mediaDevices?.getUserMedia) &&
        typeof MediaRecorder !== "undefined",
    );
  }, []);

  useEffect(() => {
    return () => {
      clearTimer();
      releaseStream();
      if (mediaRef.current && mediaRef.current.state !== "inactive") {
        try {
          mediaRef.current.stop();
        } catch {
          /* ignore */
        }
      }
    };
  }, [clearTimer, releaseStream]);

  const start = async () => {
    setPermissionErrorAr("");
    setPermissionHintAr("");
    cancelRef.current = false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = pickMimeType();
      mimeRef.current = mimeType;
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        clearTimer();
        releaseStream();
        setRecording(false);
        if (cancelRef.current) {
          chunksRef.current = [];
          setElapsedSec(0);
          return;
        }
        const type = recorder.mimeType || mimeRef.current || "audio/webm";
        const blob = new Blob(chunksRef.current, { type });
        chunksRef.current = [];
        if (blob.size === 0) return;
        const durationSec = Math.max(0.5, (Date.now() - startedAtRef.current) / 1000);
        const filename = `agent-voice.${extensionForMime(type)}`;
        onRecorded({ blob, mimeType: type, filename, durationSec });
      };
      mediaRef.current = recorder;
      startedAtRef.current = Date.now();
      setElapsedSec(0);
      recorder.start(250);
      setRecording(true);
      timerRef.current = window.setInterval(() => {
        setElapsedSec((Date.now() - startedAtRef.current) / 1000);
      }, 200);
    } catch (error) {
      const copy = permissionErrorFromUnknown(error, "microphone");
      const name =
        error instanceof DOMException
          ? error.name
          : error && typeof error === "object" && "name" in error
            ? String((error as { name: unknown }).name)
            : "";
      if (name === "NotAllowedError" || /permission|denied|not allowed/i.test(copy.error)) {
        setPermissionErrorAr("يرجى منح إذن الميكروفون للمتابعة");
      } else {
        setPermissionErrorAr(copy.errorAr);
      }
      setPermissionHintAr(copy.hintAr);
      releaseStream();
    }
  };

  const stopAndSend = () => {
    cancelRef.current = false;
    clearTimer();
    if (mediaRef.current && mediaRef.current.state !== "inactive") {
      mediaRef.current.stop();
    } else {
      setRecording(false);
      releaseStream();
    }
  };

  const cancel = () => {
    cancelRef.current = true;
    clearTimer();
    if (mediaRef.current && mediaRef.current.state !== "inactive") {
      mediaRef.current.stop();
    } else {
      setRecording(false);
      releaseStream();
      setElapsedSec(0);
    }
  };

  return (
    <div className="agent-voice-recorder" dir="rtl" lang="ar">
      {!supported ? (
        <p className="agent-voice-error" role="alert">
          هذا المتصفح لا يدعم تسجيل الصوت. استخدم Chrome أو Firefox.
        </p>
      ) : null}
      {permissionErrorAr ? (
        <div className="agent-voice-error" role="alert">
          <p>{permissionErrorAr}</p>
          {permissionHintAr ? <p className="muted">{permissionHintAr}</p> : null}
        </div>
      ) : null}

      {!recording ? (
        <button
          type="button"
          className="btn agent-voice-live-btn"
          disabled={disabled || !supported}
          onClick={() => void start()}
        >
          تسجيل صوتي مباشر
        </button>
      ) : (
        <div className="agent-voice-recording" role="status" aria-live="polite">
          <span className="agent-voice-pulse-dot" aria-hidden />
          <span className="agent-voice-timer">{formatTimer(elapsedSec)}</span>
          <div className="agent-voice-rec-actions">
            <button type="button" className="btn" onClick={stopAndSend}>
              إيقاف وإرسال
            </button>
            <button type="button" className="btn ghost-btn" onClick={cancel}>
              إلغاء
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
