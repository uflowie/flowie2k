-- Music streaming server database schema
-- Consolidated schema including all migrations

-- Music metadata table
CREATE TABLE IF NOT EXISTS tracks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  filename TEXT NOT NULL,
  storage_key TEXT NOT NULL UNIQUE,
  title TEXT,
  artist TEXT,
  album TEXT,
  genre TEXT,
  duration INTEGER, -- in seconds
  file_size INTEGER NOT NULL,
  mime_type TEXT NOT NULL,
  uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  thumbnail_path TEXT,
  seconds_listened INTEGER NOT NULL DEFAULT 0,
  last_played DATETIME
);

-- Playlists table
CREATE TABLE IF NOT EXISTS playlists (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_played DATETIME
);

-- Junction table for playlist-track relationships
CREATE TABLE IF NOT EXISTS playlist_tracks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  playlist_id INTEGER NOT NULL,
  track_id INTEGER NOT NULL,
  added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
  FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE,
  UNIQUE(playlist_id, track_id)
);

-- Listening analytics events table
CREATE TABLE IF NOT EXISTS listening_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  track_id INTEGER NOT NULL,
  listened_for_seconds INTEGER NOT NULL DEFAULT 1,
  started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_tracks_filename ON tracks(filename);
CREATE INDEX IF NOT EXISTS idx_tracks_artist ON tracks(artist);
CREATE INDEX IF NOT EXISTS idx_tracks_album ON tracks(album);

CREATE INDEX IF NOT EXISTS idx_playlists_name ON playlists(name);
CREATE INDEX IF NOT EXISTS idx_playlist_tracks_playlist_id ON playlist_tracks(playlist_id);
CREATE INDEX IF NOT EXISTS idx_playlist_tracks_track_id ON playlist_tracks(track_id);

CREATE INDEX IF NOT EXISTS idx_listening_events_track_id ON listening_events(track_id);
CREATE INDEX IF NOT EXISTS idx_listening_events_started_at ON listening_events(started_at);
CREATE INDEX IF NOT EXISTS idx_listening_events_track_started ON listening_events(track_id, started_at DESC);
