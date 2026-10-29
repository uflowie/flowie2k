import { tracks } from "@schema";
import { defineHandler } from "void";
import { db, eq } from "void/db";
import { storage } from "void/storage";

import { idParams } from "@/server/validation";

// DELETE /api/songs/:id — removes the files from R2 and the track row
export const DELETE = defineHandler.withValidator({ params: idParams })(async (
  c,
  { params: { id } },
) => {
  const [track] = await db
    .select({ storage_key: tracks.storage_key, thumbnail_path: tracks.thumbnail_path })
    .from(tracks)
    .where(eq(tracks.id, id));

  if (!track) {
    return c.json({ error: "Song not found" }, 404);
  }

  await storage.delete(
    track.thumbnail_path ? [track.storage_key, track.thumbnail_path] : track.storage_key,
  );
  // Playlist entries and listening events cascade via foreign keys.
  await db.delete(tracks).where(eq(tracks.id, id));

  return { message: "Song deleted successfully" };
});
