export type SessionChannel = "telegram" | "whatsapp" | "instagram" | "web";

export type SessionStatus =
  | "started"
  | "selfie_received"
  | "active"
  | "completed"
  | "abandoned";

export interface TryOnSession {
  id: string;
  channel: SessionChannel;
  channelUserId: string;
  status: SessionStatus;
  selfieImageUrl?: string;
  createdAt: string;
  updatedAt: string;
}