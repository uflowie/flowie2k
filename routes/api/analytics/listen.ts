import { listeningEvents, playlists, tracks } from "@schema";
import { defineHandler } from "void";
import { and, db, desc, eq, inArray, sql } from "void/db";
import { z } from "zod";

// POST /api/analytics/listen — called once per second of playback
export const POST = defineHandler.withValidator({
  body: z.object({
    track_id: z.number().int().positive({ message: "Invalid track_id" }),
    playlist_id: z.number().int().positive({ message: "Invalid playlist_id" }).optional(),
  }),
})(async (c, { body: { track_id, playlist_id } }) => {
  const updatedTracks = await db
    .update(tracks)
    .set({
      seconds_listened: sql`COALESCE(${tracks.seconds_listened}, 0) + 1`,
      last_played: sql`CURRENT_TIMESTAMP`,
    })
    .where(eq(tracks.id, track_id))
    .returning({ id: tracks.id });

  if (updatedTracks.length === 0) {
    return c.json({ error: "Track not found" }, 404);
  }

  if (playlist_id !== undefined) {
    await db
      .update(playlists)
      .set({ last_played: sql`CURRENT_TIMESTAMP` })
      .where(eq(playlists.id, playlist_id));
  }

  // Extend the latest session if it ended within the last 3 seconds; otherwise start a new one.
  const latestOpenSession = db
    .select({ id: listeningEvents.id })
    .from(listeningEvents)
    .where(
      and(
        eq(listeningEvents.track_id, track_id),
        sql`(julianday('now') - julianday(${listeningEvents.started_at}, '+' || ${listeningEvents.listened_for_seconds} || ' seconds')) * 86400 <= 3.0`,
      ),
    )
    .orderBy(desc(listeningEvents.started_at))
    .limit(1);

  const extended = await db
    .update(listeningEvents)
    .set({ listened_for_seconds: sql`${listeningEvents.listened_for_seconds} + 1` })
    .where(inArray(listeningEvents.id, latestOpenSession))
    .returning({ id: listeningEvents.id });

  if (extended.length === 0) {
    await db.insert(listeningEvents).values({ track_id, listened_for_seconds: 1 });
  }

  return { success: true };
});
