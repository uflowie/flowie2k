PRAGMA foreign_keys=OFF;

CREATE TABLE IF NOT EXISTS tracks_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  filename TEXT NOT NULL,
  storage_key TEXT NOT NULL UNIQUE,
  title TEXT,
  artist TEXT,
  album TEXT,
  genre TEXT,
  duration INTEGER,
  file_size INTEGER NOT NULL,
  mime_type TEXT NOT NULL,
  uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  thumbnail_path TEXT,
  seconds_listened INTEGER NOT NULL DEFAULT 0,
  last_played DATETIME
);

INSERT INTO tracks_new (
  id,
  filename,
  storage_key,
  title,
  artist,
  album,
  genre,
  duration,
  file_size,
  mime_type,
  uploaded_at,
  thumbnail_path,
  seconds_listened,
  last_played
)
SELECT
  id,
  filename,
  filename,
  title,
  artist,
  album,
  genre,
  duration,
  file_size,
  mime_type,
  uploaded_at,
  thumbnail_path,
  seconds_listened,
  last_played
FROM tracks;

DROP TABLE tracks;
ALTER TABLE tracks_new RENAME TO tracks;

CREATE INDEX IF NOT EXISTS idx_tracks_filename ON tracks(filename);
CREATE INDEX IF NOT EXISTS idx_tracks_artist ON tracks(artist);
CREATE INDEX IF NOT EXISTS idx_tracks_album ON tracks(album);

PRAGMA foreign_keys=ON;
