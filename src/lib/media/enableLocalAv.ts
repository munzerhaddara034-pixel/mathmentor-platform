/**
 * Browser-gesture AV enable for LiveKit local participant.
 * Primes getUserMedia (permission dialog), then enables mic/camera independently.
 * Brand: Prof. Munzer Haddara / الأستاذ منذر حداره.
 */

import type { LocalParticipant } from "livekit-client";
import {
  permissionErrorFromUnknown,
  type MediaPermissionCopy,
  type MediaPermissionKind,
} from "@/lib/media/permissionCopy";

export type LocalAvEnableResult = {
  micOk: boolean;
  camOk: boolean;
  /** Present when at least one device failed. */
  failure?: MediaPermissionCopy;
  failureKind?: MediaPermissionKind;
};

function stopTracks(stream: MediaStream | null): void {
  if (!stream) return;
  stream.getTracks().forEach((track) => {
    try {
      track.stop();
    } catch {
      /* ignore stop errors */
    }
  });
}

/**
 * Force the browser permission prompt via getUserMedia, then release tracks
 * so LiveKit can publish its own. Falls back to per-kind probes on partial denial.
 */
async function primeBrowserMediaPermission(wantVideo = true): Promise<{
  audioGranted: boolean;
  videoGranted: boolean;
  primeError?: unknown;
}> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    return {
      audioGranted: false,
      videoGranted: false,
      primeError: new Error("getUserMedia is not available in this browser."),
    };
  }

  if (!wantVideo) {
    // Audio-first («صوت فقط»): never open the camera, so no permission prompt for it.
    try {
      const audioOnly = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      stopTracks(audioOnly);
      return { audioGranted: true, videoGranted: false };
    } catch (audioError) {
      return { audioGranted: false, videoGranted: false, primeError: audioError };
    }
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
    stopTracks(stream);
    return { audioGranted: true, videoGranted: true };
  } catch (bothError) {
    let audioGranted = false;
    let videoGranted = false;
    try {
      const audioOnly = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      stopTracks(audioOnly);
      audioGranted = true;
    } catch {
      audioGranted = false;
    }
    try {
      const videoOnly = await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
      stopTracks(videoOnly);
      videoGranted = true;
    } catch {
      videoGranted = false;
    }
    if (!audioGranted && !videoGranted) {
      return { audioGranted: false, videoGranted: false, primeError: bothError };
    }
    return { audioGranted, videoGranted, primeError: bothError };
  }
}

function logAv(event: string, detail: Record<string, string | boolean | number>): void {
  // No tokens, URLs with secrets, or device IDs — safe console diagnostics only.
  console.info(`[mathmentor-av] ${event}`, detail);
}

/**
 * User-gesture AV enable: prime permissions, then enable LiveKit mic/camera separately
 * so a single-device failure does not silently block the other.
 */
export async function enableLocalParticipantAv(
  localParticipant: LocalParticipant,
  options: { camera?: boolean } = {},
): Promise<LocalAvEnableResult> {
  const wantCamera = options.camera !== false;
  const prime = await primeBrowserMediaPermission(wantCamera);
  logAv("prime", {
    audioGranted: prime.audioGranted,
    videoGranted: prime.videoGranted,
    primeFailed: Boolean(prime.primeError),
  });

  if (!prime.audioGranted && !prime.videoGranted) {
    const kind = wantCamera ? "both" : "microphone";
    const failure = permissionErrorFromUnknown(prime.primeError ?? new Error("Permission denied."), kind);
    logAv("prime-blocked", { kind });
    return { micOk: false, camOk: false, failure, failureKind: kind };
  }

  if (!wantCamera) {
    try {
      await localParticipant.setMicrophoneEnabled(true);
      logAv("enable", { micOk: true, camOk: false, audioOnly: true });
      return { micOk: true, camOk: false };
    } catch (error) {
      return { micOk: false, camOk: false, failure: permissionErrorFromUnknown(error, "microphone"), failureKind: "microphone" };
    }
  }

  let micOk = false;
  let camOk = false;
  let micError: unknown;
  let camError: unknown;

  if (prime.audioGranted) {
    try {
      await localParticipant.setMicrophoneEnabled(true);
      micOk = true;
    } catch (error) {
      micError = error;
      micOk = false;
    }
  } else {
    micError = prime.primeError ?? new Error("Microphone permission denied.");
  }

  if (prime.videoGranted) {
    try {
      await localParticipant.setCameraEnabled(true);
      camOk = true;
    } catch (error) {
      camError = error;
      camOk = false;
    }
  } else {
    camError = prime.primeError ?? new Error("Camera permission denied.");
  }

  logAv("enable", { micOk, camOk });

  if (micOk && camOk) {
    return { micOk: true, camOk: true };
  }

  if (micOk && !camOk) {
    return {
      micOk: true,
      camOk: false,
      failure: permissionErrorFromUnknown(camError, "camera"),
      failureKind: "camera",
    };
  }

  if (!micOk && camOk) {
    return {
      micOk: false,
      camOk: true,
      failure: permissionErrorFromUnknown(micError, "microphone"),
      failureKind: "microphone",
    };
  }

  return {
    micOk: false,
    camOk: false,
    failure: permissionErrorFromUnknown(micError ?? camError ?? prime.primeError, "both"),
    failureKind: "both",
  };
}
