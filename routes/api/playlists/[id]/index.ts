import { playlists } from "@schema";
import { defineHandler } from "void";
import { db, eq, sql } from "void/db";

import { idParams, playlistName } from "@/server/validation";

// PUT /api/playlists/:id — rename
export const PUT = defineHandler.withValidator({ params: idParams, body: playlistName })(async (
  c,
  { params: { id }, body: { name } },
) => {
  const updated = await db
    .update(playlists)
    .set({ name, updated_at: sql`CURRENT_TIMESTAMP` })
    .where(eq(playlists.id, id))
    .returning({ id: playlists.id });

  if (updated.length === 0) {
    return c.json({ error: "Playlist not found" }, 404);
  }
  return { message: "Playlist updated successfully", id, name };
});

// DELETE /api/playlists/:id
export const DELETE = defineHandler.withValidator({ params: idParams })(async (
  c,
  { params: { id } },
) => {
  const deleted = await db
    .delete(playlists)
    .where(eq(playlists.id, id))
    .returning({ id: playlists.id });

  if (deleted.length === 0) {
    return c.json({ error: "Playlist not found" }, 404);
  }
  return { message: "Playlist deleted successfully" };
});
