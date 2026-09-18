/** In-room data-channel messages (topic `mathmentor`). */

export const LIVEKIT_DATA_TOPIC = "mathmentor";

export type WhiteboardPoint = { x: number; y: number };

export type WhiteboardStroke = {
  id: string;
  color: string;
  width: number;
  points: WhiteboardPoint[];
  authorId: string;
};

export type WhiteboardEquation = {
  id: string;
  latex: string;
  authorId: string;
  createdAt: string;
};

export type ClassroomChatLine = {
  id: string;
  identity: string;
  name: string;
  text: string;
  at: string;
};

export type ClassroomDataMessage =
  | { kind: "whiteboard.stroke"; stroke: WhiteboardStroke }
  | { kind: "whiteboard.equation"; equation: WhiteboardEquation }
  | { kind: "whiteboard.clear" }
  | { kind: "whiteboard.grant"; identity: string; allowed: boolean }
  | { kind: "av.grant"; identity: string; allowed: boolean }
  | { kind: "hand"; identity: string; raised: boolean; name?: string }
  | { kind: "chat"; line: ClassroomChatLine }
  | { kind: "class.end" };

export type ClassroomGrants = {
  room: string;
  roomJoin: boolean;
  roomCreate: boolean;
  roomAdmin: boolean;
  canPublish: boolean;
  canSubscribe: boolean;
  canPublishData: boolean;
  canUpdateOwnMetadata: boolean;
};

export type ClassroomTokenPayload = {
  ok: boolean;
  demo: boolean;
  token: string | null;
  serverUrl: string | null;
  roomName: string;
  identity: string;
  name: string;
  isTeacher: boolean;
  canWriteBoard: boolean;
  canPublishAv: boolean;
  grants: ClassroomGrants;
  error?: string;
  errorAr?: string;
  docs?: string;
};
