import { z } from "zod";

export const positiveId = z.coerce.number().int().positive();

export const idParams = z.object({ id: positiveId });

export const playlistName = z.object({
  name: z.string().trim().min(1, { message: "Playlist name is required" }),
});
