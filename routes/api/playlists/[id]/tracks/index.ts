import { playlists, playlistTracks, tracks } from "@schema";
import { defineHandler } from "void";
import { asc, db, eq, sql } from "void/db";
import { z } from "zod";

import { trackDisplayColumns } from "@/server/tracks";
import { idParams } from "@/server/validation";

// GET /api/playlists/:id/tracks — playlist info and its tracks in insertion order
export const GET = defineHandler.withValidator({ params: idParams })(async (
  c,
  { params: { id } },
) => {
  const [playlist] = await db
    .select({
      id: playlists.id,
      name: playlists.name,
      created_at: playlists.created_at,
      updated_at: playlists.updated_at,
    })
    .from(playlists)
    .where(eq(playlists.id, id));

  if (!playlist) {
    return c.json({ error: "Playlist not found" }, 404);
  }

  const rows = await db
    .select({ ...trackDisplayColumns, playlist_added_at: playlistTracks.added_at })
    .from(tracks)
    .innerJoin(playlistTracks, eq(tracks.id, playlistTracks.track_id))
    .where(eq(playlistTracks.playlist_id, id))
    .orderBy(asc(playlistTracks.added_at));

  return { playlist, tracks: rows };
});

// POST /api/playlists/:id/tracks — add a track (no-op if already present)
export const POST = defineHandler.withValidator({
  params: idParams,
  body: z.object({ trackId: z.number().int().positive({ message: "Track ID is required" }) }),
})(async (c, { params: { id }, body: { trackId } }) => {
  const [playlist] = await db
    .select({ id: playlists.id })
    .from(playlists)
    .where(eq(playlists.id, id));
  if (!playlist) {
    return c.json({ error: "Playlist not found" }, 404);
  }

  const [track] = await db.select({ id: tracks.id }).from(tracks).where(eq(tracks.id, trackId));
  if (!track) {
    return c.json({ error: "Track not found" }, 404);
  }

  await db.batch([
    db.insert(playlistTracks).values({ playlist_id: id, track_id: trackId }).onConflictDoNothing(),
    db
      .update(playlists)
      .set({ updated_at: sql`CURRENT_TIMESTAMP` })
      .where(eq(playlists.id, id)),
  ]);

  return { message: "Track added to playlist successfully" };
});
