import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function TeacherVoiceMathPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id } = await searchParams;
  redirect(id ? `/studio/voice-solver?id=${encodeURIComponent(id)}` : "/studio/voice-solver");
}
