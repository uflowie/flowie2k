import { listeningEvents, tracks } from "@schema";
import { defineHandler } from "void";
import { and, db, desc, eq, sql } from "void/db";
import { z } from "zod";

import { trackColumns } from "../../../src/server/tracks";

// GET /api/songs?sort=popular|recent&days=N
export const GET = defineHandler.withValidator({
  query: z.object({
    sort: z.enum(["popular", "recent"]).optional(),
    days: z.coerce.number().int().min(1).optional(),
  }),
})(async (_c, { query: { sort, days } }) => {
  if (sort === "popular" && days !== undefined) {
    // Rank by seconds listened within the last `days` days.
    const windowSeconds = sql<number>`COALESCE(SUM(${listeningEvents.listened_for_seconds}), 0)`;
    const songs = await db
      .select({ ...trackColumns, window_seconds: windowSeconds })
      .from(tracks)
      .leftJoin(
        listeningEvents,
        and(
          eq(tracks.id, listeningEvents.track_id),
          sql`${listeningEvents.started_at} >= datetime('now', ${`-${days} day`})`,
        ),
      )
      .groupBy(tracks.id)
      .having(sql`${windowSeconds} > 0`)
      .orderBy(desc(windowSeconds), desc(tracks.uploaded_at));
    return { songs };
  }

  const songs = await db
    .select({ ...trackColumns, window_seconds: sql<number>`0` })
    .from(tracks)
    .orderBy(
      ...(sort === "popular"
        ? [desc(tracks.seconds_listened), desc(tracks.uploaded_at)]
        : [desc(tracks.uploaded_at)]),
    );
  return { songs };
});
