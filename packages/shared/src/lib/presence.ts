import { z } from "zod";

export const presenceSnapshotSchema = z.object({
  onlineUserIds: z.array(z.string().cuid()),
});

export type PresenceSnapshot = z.infer<typeof presenceSnapshotSchema>;

export const presenceUpdateSchema = z.object({
  userId: z.string().cuid(),
  isOnline: z.boolean(),
});

export type PresenceUpdate = z.infer<typeof presenceUpdateSchema>;
