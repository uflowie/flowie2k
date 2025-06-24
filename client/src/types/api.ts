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
  listen_count: number
  total_seconds: number
  avg_seconds_per_session: number
  first_listen?: string
  last_listen?: string
}

export interface SongsResponse {
  songs: Track[]
}

export interface ApiError {
  error: string
}