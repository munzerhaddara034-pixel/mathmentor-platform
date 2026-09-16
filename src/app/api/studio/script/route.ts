import { NextResponse } from "next/server";
import { z } from "zod";
import { generateLessonScript } from "@/lib/studio/scriptGenerator";
import { certificateTrackSchema, countExampleSteps, hasGradedExample, hasRenderGraph, hasStepByStep, lessonLanguageSchema } from "@/lib/studio/timeline";

export const runtime = "nodejs";

const bodySchema = z.object({
  topic: z.string().min(1),
  track: certificateTrackSchema.or(z.string().min(1)),
  language: lessonLanguageSchema,
  grade: z.string().optional(),
});

export async function POST(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Expected { topic, track, language, grade? }.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const result = await generateLessonScript({
      topic: parsed.data.topic,
      track: parsed.data.track,
      language: parsed.data.language,
      grade: parsed.data.grade,
    });

    const phases = result.timeline.segments.map((segment) => segment.phase);
    return NextResponse.json({
      ...result,
      pedagogy: {
        phases,
        hasRenderGraph: hasRenderGraph(result.timeline),
        hasStepByStepEquations: hasStepByStep(result.timeline),
        gradedSteps: countExampleSteps(result.timeline),
        gradedExampleReady: hasGradedExample(result.timeline),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not generate script." },
      { status: 500 },
    );
  }
}
