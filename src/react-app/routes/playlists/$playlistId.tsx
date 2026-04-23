import { createFileRoute } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { useEffect, useMemo } from "react"

import {
  getPlaylistKey,
  resolvePlaylist,
} from "@/react-app/lib/playlists"
import { getPlaylistsQueryOptions } from "@/react-app/lib/query-options"
import { usePlaybackStore } from "@/react-app/lib/playback-store"
import { PlaylistSongsView } from "@/react-app/components/playlist-songs-view"
import type { PlaylistSummary } from "@/react-app/lib/types"

const EMPTY_PLAYLISTS: PlaylistSummary[] = []

export const Route = createFileRoute("/playlists/$playlistId")({
  component: PlaylistRoute,
})

function PlaylistRoute() {
  const { playlistId } = Route.useParams()
  const {
    data: playlistsResponse,
    isLoading: playlistsLoading,
    isError: playlistsError,
  } = useQuery(getPlaylistsQueryOptions())
  const playlists = playlistsResponse?.playlists ?? EMPTY_PLAYLISTS
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
