import type { PlaylistSummary } from "@/react-app/lib/types"

export type SmartPlaylistId = "all" | "popular-30" | "popular-90" | "popular-365"

export type SmartPlaylist = {
  type: "smart"
  id: SmartPlaylistId
  name: string
  sort: "popular" | "recent"
  days?: number
}

export type CustomPlaylist = {
  type: "custom"
  id: number
  name: string
}

export type ActivePlaylist = SmartPlaylist | CustomPlaylist

export const SMART_PLAYLISTS = [
  {
    type: "smart",
    id: "all",
    name: "All Songs",
    sort: "recent",
  },
  {
    type: "smart",
    id: "popular-30",
    name: "Most Popular 30 days",
    sort: "popular",
    days: 30,
  },
  {
    type: "smart",
    id: "popular-90",
    name: "Most Popular 90 days",
    sort: "popular",
    days: 90,
  },
  {
    type: "smart",
    id: "popular-365",
    name: "Most Popular 365 days",
    sort: "popular",
    days: 365,
  },
] satisfies readonly SmartPlaylist[]

export const SMART_PLAYLISTS_BY_ID = Object.fromEntries(
  SMART_PLAYLISTS.map((playlist) => [playlist.id, playlist] as const),
) as Record<SmartPlaylistId, SmartPlaylist>

export const DEFAULT_PLAYLIST = SMART_PLAYLISTS_BY_ID.all

export const getPlaylistKey = (playlist: ActivePlaylist) =>
  playlist.type === "custom"
    ? `custom:${playlist.id}`
    : `smart:${playlist.id}`

export const toCustomPlaylist = (playlist: PlaylistSummary): CustomPlaylist => ({
  type: "custom",
  id: playlist.id,
  name: playlist.name,
})

export const resolvePlaylist = (
  playlistId: string,
  playlists: PlaylistSummary[],
): ActivePlaylist => {
  const smartPlaylist = SMART_PLAYLISTS_BY_ID[playlistId as SmartPlaylistId]
  if (smartPlaylist) {
    return smartPlaylist
  }

  const numericId = Number(playlistId)
  if (Number.isInteger(numericId) && numericId > 0) {
    const matchedPlaylist = playlists.find((playlist) => playlist.id === numericId)
    return matchedPlaylist
      ? toCustomPlaylist(matchedPlaylist)
      : {
          type: "custom",
          id: numericId,
          name: `Playlist ${numericId}`,
        }
  }

  return DEFAULT_PLAYLIST
}

export const getPlaylistStatusMessage = ({
  playlists,
  isLoading,
  isError,
}: {
  playlists: PlaylistSummary[]
  isLoading: boolean
  isError: boolean
}) => {
  if (isLoading) {
    return "Loading playlists..."
  }
  if (isError) {
    return "Failed to load playlists"
  }
  if (playlists.length === 0) {
    return "No playlists yet"
  }
  return null
}
