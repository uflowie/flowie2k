import { tracks } from "@schema";
import { defineHandler } from "void";
import { db, eq, sql } from "void/db";
import { storage } from "void/storage";

import { idParams } from "@/server/validation";

// DELETE /api/songs/:id — removes the track row and its files from R2
export const DELETE = defineHandler.withValidator({ params: idParams })(async (
  c,
  { params: { id } },
) => {
  // Playlist entries and listening events cascade via foreign keys.
  const [track] = await db
    .delete(tracks)
    .where(eq(tracks.id, id))
    .returning({ storage_key: tracks.storage_key, thumbnail_path: tracks.thumbnail_path });

  if (!track) {
    return c.json({ error: "Song not found" }, 404);
  }

  await storage.delete(track.storage_key);

  // Covers are shared between songs with identical art; keep it while others use it.
  if (track.thumbnail_path) {
    const [{ users }] = await db
      .select({ users: sql<number>`COUNT(*)` })
      .from(tracks)
      .where(eq(tracks.thumbnail_path, track.thumbnail_path));
    if (users === 0) await storage.delete(track.thumbnail_path);
  }

  return { message: "Song deleted successfully" };
});
