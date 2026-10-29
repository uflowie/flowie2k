import { tracks } from "@schema";

// Track fields returned to the client (everything except mime_type).
export const trackDisplayColumns = {
  id: tracks.id,
  filename: tracks.filename,
  storage_key: tracks.storage_key,
  file_size: tracks.file_size,
  title: tracks.title,
  artist: tracks.artist,
  album: tracks.album,
  genre: tracks.genre,
  duration: tracks.duration,
  uploaded_at: tracks.uploaded_at,
  thumbnail_path: tracks.thumbnail_path,
  seconds_listened: tracks.seconds_listened,
  last_played: tracks.last_played,
};

export const trackColumns = {
  ...trackDisplayColumns,
  mime_type: tracks.mime_type,
};
