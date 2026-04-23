import type { QueryClient } from "@tanstack/react-query"

import { fetchPlaylists } from "@/react-app/lib/api"
import { fetchSongsForPlaylist } from "@/react-app/lib/songs"
import { getPlaylistKey, type ActivePlaylist } from "@/react-app/lib/playlists"

const DEFAULT_QUERY_OPTIONS = {
  staleTime: 30_000,
  gcTime: 5 * 60_000,
} as const

export const LIBRARY_QUERY_KEYS = {
  playlists: ["playlists"] as const,
  songs: ["songs"] as const,
}

export const getPlaylistsQueryOptions = () => ({
  queryKey: LIBRARY_QUERY_KEYS.playlists,
  queryFn: fetchPlaylists,
  ...DEFAULT_QUERY_OPTIONS,
})

export const getSongsQueryOptions = (playlist: ActivePlaylist) => ({
  queryKey: [...LIBRARY_QUERY_KEYS.songs, getPlaylistKey(playlist)] as const,
  queryFn: () => fetchSongsForPlaylist(playlist),
  ...DEFAULT_QUERY_OPTIONS,
})

export const invalidateSongsQuery = (queryClient: QueryClient) =>
  queryClient.invalidateQueries({ queryKey: LIBRARY_QUERY_KEYS.songs })

export const invalidatePlaylistsQuery = (queryClient: QueryClient) =>
  queryClient.invalidateQueries({ queryKey: LIBRARY_QUERY_KEYS.playlists })

export const invalidateLibraryQueries = (queryClient: QueryClient) =>
  Promise.all([
    invalidateSongsQuery(queryClient),
    invalidatePlaylistsQuery(queryClient),
  ])
