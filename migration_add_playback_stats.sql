-- Add listening statistics columns for playback analytics
ALTER TABLE tracks ADD COLUMN seconds_listened INTEGER NOT NULL DEFAULT 0;
ALTER TABLE tracks ADD COLUMN last_played DATETIME;
ALTER TABLE playlists ADD COLUMN last_played DATETIME;
