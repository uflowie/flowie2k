-- Remove analytics tracking from music server
-- This migration removes play tracking functionality

-- Drop analytics table and its indexes
DROP INDEX IF EXISTS idx_play_events_track_id;
DROP INDEX IF EXISTS idx_play_events_played_at;
DROP TABLE IF EXISTS play_events;

-- SQLite doesn't support DROP COLUMN IF EXISTS, so we need to recreate the table
-- Create new tracks table without analytics columns
CREATE TABLE tracks_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  filename TEXT NOT NULL UNIQUE,
  title TEXT,
  artist TEXT,
  album TEXT,
  genre TEXT,
  duration INTEGER, -- in seconds
  file_size INTEGER NOT NULL,
  mime_type TEXT NOT NULL,
  uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  thumbnail_path TEXT
);

-- Copy data from old table (excluding analytics columns)
INSERT INTO tracks_new (id, filename, title, artist, album, genre, duration, file_size, mime_type, uploaded_at, thumbnail_path)
SELECT id, filename, title, artist, album, genre, duration, file_size, mime_type, uploaded_at, thumbnail_path
FROM tracks;

-- Drop old table and rename new one
DROP TABLE tracks;
ALTER TABLE tracks_new RENAME TO tracks;

-- Recreate indexes
CREATE INDEX IF NOT EXISTS idx_tracks_filename ON tracks(filename);
CREATE INDEX IF NOT EXISTS idx_tracks_artist ON tracks(artist);
CREATE INDEX IF NOT EXISTS idx_tracks_album ON tracks(album);