import { tracks } from "@schema";
import { defineHandler } from "void";
import { db, eq } from "void/db";

import { presignGetUrl } from "@/server/presign";
import { idParams } from "@/server/validation";

// GET /api/songs/:id/stream — redirects to a presigned R2 URL
export const GET = defineHandler.withValidator({ params: idParams })(async (
  c,
  { params: { id } },
) => {
  const [track] = await db
    .select({ storage_key: tracks.storage_key })
    .from(tracks)
    .where(eq(tracks.id, id));

  if (!track) {
    return c.json({ error: "Song not found" }, 404);
  }

  c.header("Cache-Control", "private, no-store");
  c.header("Referrer-Policy", "no-referrer");
  return c.redirect(await presignGetUrl(track.storage_key, 86400), 307);
});
