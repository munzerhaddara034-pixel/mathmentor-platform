export { DEMO_DICTATIONS, DEMO_DICTATION_AR, DEMO_DICTATION_EN, defaultDemoDictation } from "./demo";
export { spokenMathToPlain, extractLatexHints } from "./phrases";
export { transcribeAudioOrDemo, hasWhisperKey } from "./whisper";
export { parseSpeechToMath } from "./parser";
export { runVoiceMath, recordVoiceJob } from "./engine";
export { getVoiceJob, listVoiceJobs, patchVoiceJob, getVoiceAudio, saveVoiceAudio } from "./store";
export { syncTimelineToAudio, attachTeacherAudio } from "./sync";
export type { VoiceMathJob, VoiceMathResult, LatexStep, VoiceTranscript } from "./types";
