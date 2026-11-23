export type BroadcastRole = "buyer" | "organizer" | "all";

export type BroadcastInput = {
  title: string;
  message?: string;
  type?: "order" | "payment" | "event" | "system";
  role: BroadcastRole;
};

export type PushTokenInput = {
  token: string;
};
