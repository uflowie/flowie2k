import { listeningEvents } from "@schema";
import { defineHandler } from "void";
import { db, eq, sql } from "void/db";
import { z } from "zod";

import { positiveId } from "@/server/validation";

// GET /api/analytics/stats/:track_id
export const GET = defineHandler.withValidator({
  params: z.object({ track_id: positiveId }),
})(async (_c, { params: { track_id } }) => {
  const [stats] = await db
    .select({
      listen_count: sql<number>`COUNT(*)`,
      total_seconds: sql<number | null>`SUM(${listeningEvents.listened_for_seconds})`,
      avg_seconds_per_session: sql<number | null>`AVG(${listeningEvents.listened_for_seconds})`,
      first_listen: sql<string | null>`MIN(${listeningEvents.started_at})`,
      last_listen: sql<string | null>`MAX(${listeningEvents.started_at})`,
    })
    .from(listeningEvents)
    .where(eq(listeningEvents.track_id, track_id));
  return stats;
});
