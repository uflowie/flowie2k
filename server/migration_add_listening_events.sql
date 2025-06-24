-- Listening analytics events table
CREATE TABLE IF NOT EXISTS listening_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  track_id INTEGER NOT NULL,
  listened_for_seconds INTEGER NOT NULL DEFAULT 1,
  started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (track_id) REFERENCES tracks(id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_listening_events_track_id ON listening_events(track_id);
CREATE INDEX IF NOT EXISTS idx_listening_events_started_at ON listening_events(started_at);
CREATE INDEX IF NOT EXISTS idx_listening_events_track_started ON listening_events(track_id, started_at DESC);