import { LiveClassroomComponent } from "@/components/live/LiveClassroomComponent";
import { getLiveSession } from "@/lib/auth/session";
import { isStaffRole } from "@/lib/auth/paths";
import { sanitizeRoomName } from "@/lib/livekit/rooms";

export const dynamic = "force-dynamic";

export default async function LiveClassroomPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  const live = await getLiveSession();
  if (!live.ok) return null;
  const room = sanitizeRoomName(decodeURIComponent(roomId));
  return (
    <LiveClassroomComponent
      roomId={room}
      user={{ id: live.user.id, name: live.user.name, role: live.user.role }}
      staff={isStaffRole(live.user.role)}
    />
  );
}
