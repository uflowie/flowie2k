import { playlists } from "@schema";
import { defineHandler } from "void";
import { db, desc, sql } from "void/db";

import { playlistName } from "@/server/validation";

// GET /api/playlists — most recently played or edited first
export const GET = defineHandler(async () => {
  const rows = await db
    .select()
    .from(playlists)
    .orderBy(desc(sql`COALESCE(${playlists.last_played}, ${playlists.updated_at})`));
  return { playlists: rows };
});

// POST /api/playlists
export const POST = defineHandler.withValidator({ body: playlistName })(async (
  _c,
  { body: { name } },
) => {
  const [playlist] = await db.insert(playlists).values({ name }).returning({ id: playlists.id });
  return { message: "Playlist created successfully", id: playlist.id, name };
});
