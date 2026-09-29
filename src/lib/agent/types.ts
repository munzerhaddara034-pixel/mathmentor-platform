/**
 * Autonomous Operations & Growth AI Agent — domain types.
 * Brand: Prof. Munzer Haddara / الأستاذ منذر حداره — never Al-Tarah / الطارة.
 */

export type AgentAudience = "brevet" | "terminale_gs" | "terminale_ls" | "parents" | "schools" | "general";

export type AgentIntentKind =
  | "generate_video"
  | "school_report"
  | "platform_health"
  | "broadcast_message"
  | "schedule_appointment"
  | "add_reminder"
  | "daily_briefing"
  | "code_evolution_request"
  | "school_outreach_request"
  | "general_task";

export type AgentTaskStatus = "queued" | "processing" | "completed" | "failed" | "demo";

export type SocialChannel = "instagram" | "tiktok" | "facebook";

export type BaremeMistakeTrend = {
  topic: string;
  topicAr: string;
  /** Lebanese Barème pitfall code, e.g. limits, asymptotes, derivatives */
  baremeCode: "limits" | "asymptotes" | "derivatives" | "domain" | "variation" | "other";
  count: number;
  ratePct: number;
};

export type StudentProgressRow = {
  studentId: string;
  studentName: string;
  gradeLabel: string;
  completionRate: number;
  lastActiveAt: string;
  weakTopics: string[];
};

export type SchoolReportPdfPayload = {
  titleAr: string;
  titleEn: string;
  html: string;
  textSummary: string;
  generatedAt: string;
};

export type SchoolReport = {
  id: string;
  schoolName: string;
  partnerCode?: string;
  periodLabel: string;
  studentProgress: StudentProgressRow[];
  baremeMistakeTrends: BaremeMistakeTrend[];
  completionRate: number;
  pdf: SchoolReportPdfPayload;
  whishWalletPhone: string;
  whishWalletNameAr: string;
  createdAt: string;
  source: "analytics" | "mock";
};

export type ParentDigestWhatsAppPayload = {
  to?: string;
  bodyAr: string;
  bodyEn: string;
  kind: "parent_digest";
};

export type ParentDigest = {
  id: string;
  studentName: string;
  parentPhone?: string;
  weekLabel: string;
  weeklyActivity: {
    sessionsCompleted: number;
    quizzesTaken: number;
    minutesStudied: number;
    liveBookings: number;
  };
  strongPoints: string[];
  strongPointsAr: string[];
  weakPoints: string[];
  weakPointsAr: string[];
  whatsapp: ParentDigestWhatsAppPayload;
  createdAt: string;
  source: "analytics" | "mock";
};

export type MarketingScriptPair = {
  ar: string;
  en: string;
  durationHintSec: number;
  hooks: string[];
};

export type SocialDispatchLog = {
  id: string;
  channel: SocialChannel;
  status: "draft" | "pending_approval" | "approved" | "posted" | "skipped";
  payloadPreview: string;
  createdAt: string;
  approved?: boolean;
};

export type MarketingCampaign = {
  id: string;
  title: string;
  audience: AgentAudience;
  scripts: MarketingScriptPair;
  heygenVideoId?: string;
  heygenJobId?: string;
  videoStatus: AgentTaskStatus;
  videoUrl?: string;
  socialLogs: SocialDispatchLog[];
  autoPostApproved: boolean;
  demo: boolean;
  createdAt: string;
  updatedAt: string;
  message: string;
};

export type WhatsAppVoiceIntent = {
  kind: AgentIntentKind;
  confidence: number;
  parameters: Record<string, string | number | boolean | null>;
  source: "gemini" | "heuristic" | "demo";
};

export type VoiceOutboundWhatsApp = {
  status: "sent" | "logged" | "failed" | "skipped";
  provider?: string;
  to?: string;
  error?: string;
  messageId?: string;
  at: string;
};

export type WhatsAppVoiceTask = {
  id: string;
  audioLog: {
    filename?: string;
    mimeType?: string;
    mediaUrl?: string;
    bytesLength?: number;
    receivedAt: string;
    senderPhone?: string;
  };
  whisperTranscript: string;
  transcriptSource: "whisper" | "demo" | "typed";
  transcriptWarning?: string;
  intent: WhatsAppVoiceIntent;
  status: AgentTaskStatus;
  automatedReplyText: string;
  relatedIds: string[];
  /** Last outbound WhatsApp confirmation status (Agent Hub Recent voice). */
  outboundWhatsApp?: VoiceOutboundWhatsApp;
  createdAt: string;
  updatedAt: string;
};

export type PlatformHealthMetric = {
  endpoint: string;
  statusCode: number;
  latencyMs: number;
  at: string;
};

export type PlatformHealthSnapshot = {
  id: string;
  checkedAt: string;
  apiStatus: "healthy" | "degraded" | "down" | "demo";
  recentErrors: PlatformHealthMetric[];
  avgLatencyMs: number;
  notices: string[];
  keysPresent: {
    openai: boolean;
    heygen: boolean;
    gemini: boolean;
    whatsapp: boolean;
  };
};

export type ScheduleAppointmentStatus = "scheduled" | "completed" | "cancelled" | "pending";
export type SecretarySource = "whatsapp" | "hub" | "voice";

export type ScheduleAppointment = {
  id: string;
  title: string;
  dateTime: string;
  contactPerson?: string;
  status: ScheduleAppointmentStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  source?: SecretarySource;
};

export type ActionReminderPriority = "low" | "medium" | "high";
export type ActionReminderStatus = "open" | "done" | "cancelled";

export type ActionReminder = {
  id: string;
  task: string;
  priority: ActionReminderPriority;
  dueDate: string;
  status: ActionReminderStatus;
  createdAt: string;
  updatedAt: string;
  source?: SecretarySource;
};

export type AgentStoreSnapshot = {
  schoolReports: SchoolReport[];
  parentDigests: ParentDigest[];
  campaigns: MarketingCampaign[];
  voiceTasks: WhatsAppVoiceTask[];
  health: PlatformHealthSnapshot[];
  approvals: ApprovalItem[];
  evolution: SelfEvolutionSnapshot[];
  appointments: ScheduleAppointment[];
  reminders: ActionReminder[];
};


/** Draft-and-approve lifecycle — never auto-deploy social/outreach without instructor. */
export type ApprovalState =
  | "DRAFTED"
  | "AWAITING_APPROVAL"
  | "APPROVED"
  | "DEPLOYED"
  | "REJECTED";

export type ApprovalKind =
  | "marketing_video"
  | "school_report"
  | "exam_pack"
  | "weekly_recommendation"
  | "school_outreach"
  | "code_evolution"
  | "broadcast"
  | "general";

export type ApprovalItem = {
  id: string;
  kind: ApprovalKind;
  state: ApprovalState;
  titleAr: string;
  titleEn?: string;
  previewAr: string;
  previewEn?: string;
  relatedIds: string[];
  payload: Record<string, unknown>;
  revisionNotes?: Array<{ at: string; note: string }>;
  stagingWhatsApp?: {
    status: string;
    provider?: string;
    to?: string;
    error?: string;
    messageId?: string;
    at: string;
  };
  actor?: string;
  decisionNote?: string;
  createdAt: string;
  updatedAt: string;
  approvedAt?: string;
  deployedAt?: string;
  rejectedAt?: string;
};

export type EvolutionRecommendation = {
  id: string;
  titleAr: string;
  titleEn: string;
  rationaleAr: string;
  impactScore: number;
};

export type SelfEvolutionSnapshot = {
  id: string;
  checkedAt: string;
  beirutDate: string;
  scores: {
    voiceConversion: number;
    approvalThroughput: number;
    pedagogyHealth: number;
    overall: number;
  };
  failedTopics: Array<{ topic: string; topicAr: string; count: number }>;
  socraticLoops: {
    avgHintsBeforeSolve: number;
    abandonedPct: number;
    successPct: number;
  };
  schoolObjections: Array<{ key: string; count: number }>;
  optimizationsApplied: number;
  pendingApprovals: number;
  recommendations: EvolutionRecommendation[];
  notices: string[];
};
