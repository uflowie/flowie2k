import { createFileRoute } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { useEffect, useMemo } from "react"

import { fetchPlaylists } from "@/react-app/lib/api"
import {
  getPlaylistKey,
  usePlaybackStore,
  type ActivePlaylist,
  type SmartPlaylist,
} from "@/react-app/lib/playback-store"
import { PlaylistSongsView } from "@/react-app/components/playlist-songs-view"

const smartPlaylists: Record<string, SmartPlaylist> = {
  all: {
    type: "smart",
    id: "all",
    name: "All Songs",
    sort: "recent",
  },
  "popular-30": {
    type: "smart",
    id: "popular-30",
    name: "Most Popular 30 days",
    sort: "popular",
    days: 30,
  },
  "popular-90": {
    type: "smart",
    id: "popular-90",
    name: "Most Popular 90 days",
    sort: "popular",
    days: 90,
  },
  "popular-365": {
    type: "smart",
    id: "popular-365",
    name: "Most Popular 365 days",
    sort: "popular",
    days: 365,
  },
}

export const Route = createFileRoute("/playlists/$playlistId")({
  component: PlaylistRoute,
})

function resolvePlaylist(
  playlistId: string,
  playlists: { id: number; name: string }[],
): ActivePlaylist {
  const smart = smartPlaylists[playlistId]
  if (smart) {
    return smart
  }

  const numericId = Number(playlistId)
  if (Number.isFinite(numericId)) {
    const matched = playlists.find((playlist) => playlist.id === numericId)
    return {
      type: "custom",
      id: numericId,
      name: matched?.name ?? `Playlist ${numericId}`,
    }
  }

  return smartPlaylists.all
}

function PlaylistRoute() {
  const { playlistId } = Route.useParams()
  const {
    data: playlistsResponse,
    isLoading: playlistsLoading,
    isError: playlistsError,
  } = useQuery({
    queryKey: ["playlists"],
    queryFn: fetchPlaylists,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  })
  const playlists = useMemo(() => {
    return (playlistsResponse as {
      playlists?: { id: number; name: string }[]
    })?.playlists ?? []
  }, [playlistsResponse])
  const resolvedPlaylist = useMemo(
    () => resolvePlaylist(playlistId, playlists),
    [playlistId, playlists],
  )
  const playlistKey = getPlaylistKey(resolvedPlaylist)
  const activePlaylist = usePlaybackStore((state) => state.activePlaylist)
  const setActivePlaylist = usePlaybackStore((state) => state.setActivePlaylist)

  useEffect(() => {
    if (
      getPlaylistKey(activePlaylist) === playlistKey &&
      activePlaylist.name === resolvedPlaylist.name
    ) {
      return
    }
    setActivePlaylist(resolvedPlaylist)
  }, [activePlaylist, playlistKey, resolvedPlaylist, setActivePlaylist])

  return (
    <PlaylistSongsView
      key={playlistKey}
      playlist={resolvedPlaylist}
      playlists={playlists}
      playlistsLoading={playlistsLoading}
      playlistsError={playlistsError}
    />
  )
}
