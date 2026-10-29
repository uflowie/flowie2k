import { sql } from "void/db";
import { index, integer, sqliteTable, text, unique } from "void/schema-d1";

// Keys match the column names so API responses keep their snake_case shape.

export const tracks = sqliteTable(
  "tracks",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    filename: text("filename").notNull(),
    storage_key: text("storage_key").notNull().unique(),
    title: text("title"),
    artist: text("artist"),
    album: text("album"),
    genre: text("genre"),
    duration: integer("duration"), // seconds
    file_size: integer("file_size").notNull(),
    mime_type: text("mime_type").notNull(),
    uploaded_at: text("uploaded_at").default(sql`CURRENT_TIMESTAMP`),
    thumbnail_path: text("thumbnail_path"),
    seconds_listened: integer("seconds_listened").notNull().default(0),
    last_played: text("last_played"),
  },
  (t) => [
    index("idx_tracks_filename").on(t.filename),
    index("idx_tracks_artist").on(t.artist),
    index("idx_tracks_album").on(t.album),
  ],
);

export const playlists = sqliteTable(
  "playlists",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    created_at: text("created_at").default(sql`CURRENT_TIMESTAMP`),
    updated_at: text("updated_at").default(sql`CURRENT_TIMESTAMP`),
    last_played: text("last_played"),
  },
  (t) => [index("idx_playlists_name").on(t.name)],
);

export const playlistTracks = sqliteTable(
  "playlist_tracks",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    playlist_id: integer("playlist_id")
      .notNull()
      .references(() => playlists.id, { onDelete: "cascade" }),
    track_id: integer("track_id")
      .notNull()
      .references(() => tracks.id, { onDelete: "cascade" }),
    added_at: text("added_at").default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [
    unique().on(t.playlist_id, t.track_id),
    index("idx_playlist_tracks_playlist_id").on(t.playlist_id),
    index("idx_playlist_tracks_track_id").on(t.track_id),
  ],
);

export const listeningEvents = sqliteTable(
  "listening_events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    track_id: integer("track_id")
      .notNull()
      .references(() => tracks.id, { onDelete: "cascade" }),
    listened_for_seconds: integer("listened_for_seconds").notNull().default(1),
    started_at: text("started_at").default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [
    index("idx_listening_events_track_id").on(t.track_id),
    index("idx_listening_events_started_at").on(t.started_at),
    index("idx_listening_events_track_started").on(t.track_id, sql`${t.started_at} DESC`),
  ],
);
