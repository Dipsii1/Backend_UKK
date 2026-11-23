import { z } from "zod";
import { EXPO_TOKEN_PATTERN } from "../../utils/expo-push.js";

export const broadcastSchema = z.object({
  title: z.string().trim().min(1).max(100),
  message: z.string().trim().min(1).max(500).optional(),
  type: z.enum(["order", "payment", "event", "system"]).optional(),
  role: z.enum(["buyer", "organizer", "all"]),
});

export const pushTokenSchema = z.object({
  token: z.string().trim().regex(EXPO_TOKEN_PATTERN, "Format Expo push token tidak valid"),
});
