export interface Customer {
  id: string;
  channel: "telegram" | "whatsapp" | "instagram";
  channelUserId: string;
  name?: string;
  phone?: string;
  optedInToMarketing: boolean;
  lastSessionAt?: string;
  createdAt: string;
}