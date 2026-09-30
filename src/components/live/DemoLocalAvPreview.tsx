"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { permissionErrorFromUnknown } from "@/lib/media/permissionCopy";
import { MediaPermissionBanner } from "./MediaPermissionBanner";

type Props = {
  /** When false, stop tracks and hide preview chrome. */
  enabled: boolean;
  muted: boolean;
  cameraOff: boolean;
};

/**
 * Teacher demo shell: real getUserMedia preview (local only — no LiveKit publish).
 * Starts only after a user gesture (Enable) to avoid silent permission failures.
 */
export function DemoLocalAvPreview({ enabled, muted, cameraOff }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<{ error: string; errorAr: string; hint: string; hintAr: string } | null>(
    null,
  );
  const [active, setActive] = useState(false);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setActive(false);
  }, []);

  const start = useCallback(async () => {
    setError(null);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("getUserMedia is not available in this browser.");
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        // Same low-data capture as the LiveKit room (360p, 15 fps).
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 360 }, frameRate: { ideal: 15, max: 20 } },
      });
      streamRef.current = stream;
      stream.getAudioTracks().forEach((track) => {
        track.enabled = !muted;
      });
      stream.getVideoTracks().forEach((track) => {
        track.enabled = !cameraOff;
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }
      setActive(true);
    } catch (err) {
      const copy = permissionErrorFromUnknown(err, "both");
      setError(copy);
      stop();
    }
  }, [cameraOff, muted, stop]);

  useEffect(() => {
    if (!enabled) stop();
  }, [enabled, stop]);

  useEffect(() => {
    return () => stop();
  }, [stop]);

  useEffect(() => {
    const stream = streamRef.current;
    if (!stream) return;
    stream.getAudioTracks().forEach((track) => {
      track.enabled = !muted;
    });
    stream.getVideoTracks().forEach((track) => {
      track.enabled = !cameraOff;
    });
  }, [muted, cameraOff]);

  if (!enabled) return null;

  return (
    <div className="live-demo-av">
      {error ? (
        <MediaPermissionBanner
          error={error.error}
          errorAr={error.errorAr}
          hint={error.hint}
          hintAr={error.hintAr}
          onRetry={() => void start()}
        />
      ) : null}
      {!active && !error ? (
        <MediaPermissionBanner
          tone="info"
          error="Tap Enable to open a local camera/mic preview (demo shell — not broadcast)."
          errorAr="اضغط تفعيل لفتح معاينة محلية للكاميرا/الميكروفون (وضع تجريبي — بدون بث)."
          onRetry={() => void start()}
        />
      ) : null}
      <video
        ref={videoRef}
        className="live-demo-video"
        playsInline
        muted
        autoPlay
        style={{ display: active && !cameraOff ? "block" : "none" }}
      />
      {active && cameraOff ? (
        <div className="live-tile teacher">
          <strong>معاينة محلية / Local preview</strong>
          <span>الكاميرا متوقفة / Camera off</span>
        </div>
      ) : null}
      <p className="muted" role="note">
        وضع تجريبي: المعاينة محلية فقط ولن تُبث للطلاب عبر LiveKit.
        <br />
        Demo shell: local preview only — not published to students via LiveKit.
      </p>
    </div>
  );
}
