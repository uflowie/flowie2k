import { tracks } from "@schema";
import { defineHandler } from "void";
import { db, eq } from "void/db";
import { storage } from "void/storage";

import { idParams } from "@/server/validation";

// GET /api/songs/:id/thumbnail — album art from R2
export const GET = defineHandler.withValidator({ params: idParams })(async (
  c,
  { params: { id } },
) => {
  const [track] = await db
    .select({ thumbnail_path: tracks.thumbnail_path })
    .from(tracks)
    .where(eq(tracks.id, id));

  if (!track?.thumbnail_path) {
    return c.json({ error: "Thumbnail not found" }, 404);
  }

  const thumbnail = await storage.get(track.thumbnail_path);
  if (!thumbnail) {
    return c.json({ error: "Thumbnail file not found" }, 404);
  }

  c.header("Content-Type", track.thumbnail_path.endsWith(".png") ? "image/png" : "image/jpeg");
  c.header("Cache-Control", "public, max-age=86400");
  return c.body(thumbnail.body);
});
