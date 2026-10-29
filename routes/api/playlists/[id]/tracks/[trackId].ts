import { playlists, playlistTracks } from "@schema";
import { defineHandler } from "void";
import { and, db, eq, sql } from "void/db";
import { z } from "zod";

import { positiveId } from "@/server/validation";

// DELETE /api/playlists/:id/tracks/:trackId
export const DELETE = defineHandler.withValidator({
  params: z.object({ id: positiveId, trackId: positiveId }),
})(async (c, { params: { id, trackId } }) => {
  const removed = await db
    .delete(playlistTracks)
    .where(and(eq(playlistTracks.playlist_id, id), eq(playlistTracks.track_id, trackId)))
    .returning({ id: playlistTracks.id });

  if (removed.length === 0) {
    return c.json({ error: "Track not found in playlist" }, 404);
  }

  await db
    .update(playlists)
    .set({ updated_at: sql`CURRENT_TIMESTAMP` })
    .where(eq(playlists.id, id));
  return { message: "Track removed from playlist successfully" };
});
