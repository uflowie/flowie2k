export type Bindings = {
  MUSIC_BUCKET: R2Bucket
  MUSIC_DB: D1Database
}

export interface R2ObjectInfo {
  key: string
  size: number
  etag: string
  uploaded: Date
}

export interface Track {
  id: number
  filename: string
  title?: string
  artist?: string
  album?: string
  genre?: string
  duration?: number
  file_size: number
  mime_type: string
  uploaded_at: string
  thumbnail_path?: string
}

export interface Playlist {
  id: number
  name: string
  created_at: string
  updated_at: string
}

export interface PlaylistTrack {
  id: number
  playlist_id: number
  track_id: number
  position: number
  added_at: string
}