-- Remove position column from playlist_tracks table
-- SQLite doesn't support DROP COLUMN directly, so we need to recreate the table

-- Create new table without position column
CREATE TABLE IF NOT EXISTS playlist_tracks_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  playlist_id INTEGER NOT NULL,
  track_id INTEGER NOT NULL,
  added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
  FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE,
  UNIQUE(playlist_id, track_id)
);

-- Copy data from old table to new table (excluding position column)
INSERT INTO playlist_tracks_new (id, playlist_id, track_id, added_at)
SELECT id, playlist_id, track_id, added_at FROM playlist_tracks;

-- Drop old table
DROP TABLE playlist_tracks;

-- Rename new table to original name
ALTER TABLE playlist_tracks_new RENAME TO playlist_tracks;

-- Recreate indexes
CREATE INDEX IF NOT EXISTS idx_playlist_tracks_playlist_id ON playlist_tracks(playlist_id);
CREATE INDEX IF NOT EXISTS idx_playlist_tracks_track_id ON playlist_tracks(track_id);