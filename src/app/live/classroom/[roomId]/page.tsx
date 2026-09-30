import { redirect } from "next/navigation";
import { AuthClientGuard } from "@/components/auth/AuthClientGuard";
import { LiveClassroomComponent } from "@/components/live/LiveClassroomComponent";
import { loginUrl } from "@/lib/auth/paths";
import { authorizeActor, classroomPath, resolveClassroomActor, sanitizeRoomName } from "@/lib/livekit/rooms";

export const dynamic = "force-dynamic";

export default async function LiveClassroomPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  const room = sanitizeRoomName(decodeURIComponent(roomId));
  const actor = await resolveClassroomActor();
  if (!actor) redirect(loginUrl(classroomPath(room)));
  // Guests (signed booking link, no account) may only open their own booking's room.
  if (actor.kind === "guest") {
    const access = await authorizeActor(actor, room, false);
    if (!access.ok) redirect("/live?join=invalid");
  }
  return (
    <>
      {actor.kind === "user" ? <AuthClientGuard mode="auth" /> : null}
      <LiveClassroomComponent
        roomId={room}
        user={{ id: actor.identity, name: actor.name, role: actor.kind === "user" ? actor.user.role : "guest" }}
        staff={actor.staff}
      />
    </>
  );
}
