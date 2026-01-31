export type IdRow = {
  id: number
}

export type TrackRow = {
  id: number
  filename: string
  storage_key: string
  title: string | null
  artist: string | null
  album: string | null
  genre: string | null
  duration: number | null
  file_size: number
  mime_type: string
  uploaded_at: string
  thumbnail_path: string | null
  seconds_listened: number
  last_played: string | null
}

export type TrackListRow = Omit<TrackRow, "storage_key"> & {
  window_seconds: number
}

export type TrackStorageRow = Pick<TrackRow, "filename" | "storage_key">

export type TrackThumbnailRow = Pick<TrackRow, "thumbnail_path">

export type TrackDeleteRow = Pick<
  TrackRow,
  "filename" | "storage_key" | "thumbnail_path"
>

export type PlaylistRow = {
  id: number
  name: string
  created_at: string
  updated_at: string
  last_played: string | null
}

export type PlaylistBaseRow = Omit<PlaylistRow, "last_played">

export type PlaylistTrackRow = TrackRow & {
  playlist_added_at: string
}

export type ListeningStatsRow = {
  listen_count: number
  total_seconds: number | null
  avg_seconds_per_session: number | null
  first_listen: string | null
  last_listen: string | null
}
