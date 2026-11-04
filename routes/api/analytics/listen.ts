import { listeningEvents, playlists, tracks } from "@schema";
import { defineHandler } from "void";
import { db, eq, inArray, sql } from "void/db";
import { z } from "zod";

// POST /api/analytics/listen — seconds listened per track since the client's last flush
export const POST = defineHandler.withValidator({
  body: z.object({
    listens: z
      .array(
        z.object({
          track_id: z.number().int().positive(),
          playlist_id: z.number().int().positive().optional(),
          seconds: z.number().int().positive().max(3600),
        }),
      )
      .min(1)
      .max(100),
  }),
})(async (_c, { body: { listens } }) => {
  // Skip tracks deleted in the meantime so one stale entry doesn't fail the whole batch.
  const existing = await db
    .select({ id: tracks.id })
    .from(tracks)
    .where(inArray(tracks.id, [...new Set(listens.map((listen) => listen.track_id))]));
  const existingIds = new Set(existing.map((track) => track.id));
  const valid = listens.filter((listen) => existingIds.has(listen.track_id));
  if (valid.length === 0) {
    return { success: true };
  }

  const playlistIds = [...new Set(valid.flatMap((listen) => listen.playlist_id ?? []))];
  await db.batch([
    db
      .insert(listeningEvents)
      .values(valid.map(({ track_id, seconds }) => ({ track_id, listened_for_seconds: seconds }))),
    ...valid.map(({ track_id, seconds }) =>
      db
        .update(tracks)
        .set({
          seconds_listened: sql`${tracks.seconds_listened} + ${seconds}`,
          last_played: sql`CURRENT_TIMESTAMP`,
        })
        .where(eq(tracks.id, track_id)),
    ),
    ...(playlistIds.length > 0
      ? [
          db
            .update(playlists)
            .set({ last_played: sql`CURRENT_TIMESTAMP` })
            .where(inArray(playlists.id, playlistIds)),
        ]
      : []),
  ]);

  return { success: true };
});
