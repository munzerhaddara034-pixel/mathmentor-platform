/**
 * Marketing campaign: scripts + HeyGen v2 generate (or mock) + social draft payloads.
 * Does NOT auto-post publicly without approval flag.
 */

import { createId } from "@/lib/ids";
import {
  createAvatarTalkingVideo,
  hasHeyGenKey,
  type HeyGenLanguage,
} from "@/lib/studio/heygen";
import { getHeyGenJob, newQueuedJob, upsertHeyGenJob } from "@/lib/studio/heygenJobs";
import { INSTRUCTOR_AR, INSTRUCTOR_EN } from "@/lib/pedagogy/lebanese";
import { marketingScriptsFor, parseAudience } from "./scripts";
import { getCampaign, patchCampaign, saveCampaign } from "./store";
import type {
  AgentAudience,
  MarketingCampaign,
  SocialChannel,
  SocialDispatchLog,
} from "./types";

function socialDrafts(campaign: MarketingCampaign): SocialDispatchLog[] {
  const now = new Date().toISOString();
  const channels: SocialChannel[] = ["instagram", "tiktok", "facebook"];
  const preview = [
    campaign.scripts.ar.slice(0, 180),
    "",
    campaign.scripts.en.slice(0, 180),
    "",
    `#MathMentor #${campaign.audience} #Bareme`,
    `${INSTRUCTOR_AR} · ${INSTRUCTOR_EN}`,
  ].join("\n");
  return channels.map((channel) => ({
    id: createId(`soc-${channel.slice(0, 2)}`),
    channel,
    status: campaign.autoPostApproved ? ("pending_approval" as const) : ("draft" as const),
    payloadPreview: preview,
    createdAt: now,
    approved: false,
  }));
}

export async function createMarketingCampaign(input: {
  audience?: unknown;
  language?: HeyGenLanguage;
  autoPostApproved?: boolean;
  title?: string;
}): Promise<{ campaign: MarketingCampaign; notice: string }> {
  try {
    const audience: AgentAudience = parseAudience(input.audience);
    const scripts = marketingScriptsFor(audience);
    const language: HeyGenLanguage = input.language === "en" || input.language === "fr" ? input.language : "ar";
    const narration = language === "en" ? scripts.en : scripts.ar;
    const demo = !hasHeyGenKey();
    const title =
      input.title?.trim() ||
      `MathMentor · ${audience} · ${INSTRUCTOR_EN}`;
    const now = new Date().toISOString();
    const autoPostApproved = Boolean(input.autoPostApproved);

    let heygenJobId: string | undefined;
    let heygenVideoId: string | undefined;
    let videoUrl: string | undefined;
    let videoStatus: MarketingCampaign["videoStatus"] = demo ? "demo" : "queued";
    let message = demo
      ? "HEYGEN_API_KEY empty — mock campaign video id. Poll status or wait for webhook."
      : "Dispatching HeyGen v2 video.generate…";

    const heygenJob = newQueuedJob({
      lessonId: `mkt-${audience}`,
      title,
      script: narration.slice(0, 4000),
      notes: `Ops agent marketing · Barème hooks · ${scripts.hooks.join(", ")}`,
      mathExamples: "\\lim_{x\\to-\\infty}f(x)=0\\quad f'(x)=xe^{x}",
      language,
      speed: 1,
      demo,
    });
    await upsertHeyGenJob(heygenJob);
    heygenJobId = heygenJob.id;

    if (!demo) {
      try {
        const result = await createAvatarTalkingVideo({
          script: narration.slice(0, 4000),
          language,
          title,
          speed: 1,
          callbackId: heygenJob.id,
        });
        heygenVideoId = result.videoId;
        videoUrl = result.videoUrl;
        videoStatus =
          result.status === "failed"
            ? "failed"
            : result.status === "completed"
              ? "completed"
              : "processing";
        message = result.message;
        await upsertHeyGenJob({
          ...heygenJob,
          status: videoStatus === "failed" ? "failed" : "processing",
          heygenVideoId,
          videoUrl,
          message,
          demo: false,
        });
      } catch (error) {
        videoStatus = "failed";
        message = error instanceof Error ? error.message : "HeyGen dispatch failed";
      }
    } else {
      heygenVideoId = heygenJob.heygenVideoId || `demo-mkt-${heygenJob.id}`;
      message = `${message} Mock id ${heygenVideoId}.`;
    }

    const campaign: MarketingCampaign = {
      id: createId("mkt"),
      title,
      audience,
      scripts,
      heygenVideoId,
      heygenJobId,
      videoStatus,
      videoUrl,
      socialLogs: [],
      autoPostApproved,
      demo,
      createdAt: now,
      updatedAt: now,
      message,
    };
    campaign.socialLogs = socialDrafts(campaign);
    await saveCampaign(campaign);
    return {
      campaign,
      notice: autoPostApproved
        ? "Social drafts marked pending_approval — still NOT auto-posted."
        : "Social posts kept as draft — set autoPostApproved to queue for human approval.",
    };
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : "marketing campaign failed");
  }
}

export async function applyMarketingWebhook(input: {
  callbackId?: string;
  videoId?: string;
  videoUrl?: string;
  status?: string;
}): Promise<{ campaign?: MarketingCampaign; socialPayload?: SocialDispatchLog[]; notice: string }> {
  try {
    const id = input.callbackId || input.videoId || "";
    if (!id) {
      return { notice: "No callback_id / video_id — ignored." };
    }

    let campaign = await getCampaign(id);
    if (!campaign && input.callbackId) {
      const job = await getHeyGenJob(input.callbackId);
      if (job) campaign = await getCampaign(job.id);
    }

    const completed =
      Boolean(input.videoUrl) ||
      /complete|success|done/i.test(input.status ?? "") ||
      false;

    if (!campaign) {
      return { notice: "No matching marketing campaign." };
    }

    const updated = await patchCampaign(campaign.id, {
      heygenVideoId: input.videoId ?? campaign.heygenVideoId,
      videoUrl: input.videoUrl ?? campaign.videoUrl,
      videoStatus: completed ? "completed" : /fail/i.test(input.status ?? "") ? "failed" : "processing",
      message: completed
        ? "Render complete — social payload prepared (approval required to post)."
        : campaign.message,
      socialLogs: campaign.socialLogs.map((log) =>
        completed && campaign.autoPostApproved
          ? { ...log, status: "pending_approval" as const }
          : log,
      ),
    });

    return {
      campaign: updated,
      socialPayload: updated?.socialLogs,
      notice: completed
        ? "Webhook applied. Do NOT auto-post publicly without approval flag."
        : "Webhook status stored.",
    };
  } catch (error) {
    return {
      notice: error instanceof Error ? error.message : "webhook apply failed",
    };
  }
}

export function buildSocialPostPayload(campaign: MarketingCampaign) {
  return {
    approvalRequired: true,
    autoPostApproved: campaign.autoPostApproved,
    willAutoPost: false,
    channels: campaign.socialLogs,
    captionAr: campaign.scripts.ar,
    captionEn: campaign.scripts.en,
    videoUrl: campaign.videoUrl,
    instructor: { ar: INSTRUCTOR_AR, en: INSTRUCTOR_EN },
  };
}
