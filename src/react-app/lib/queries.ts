import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query"
import { hc, parseResponse } from "hono/client"

import type { AppType } from "@/worker"
import { getPlaylistKey, type ActivePlaylist } from "@/react-app/lib/playlists"

const baseUrl = window.location.origin
const DEFAULT_QUERY_OPTIONS = {
  staleTime: 30_000,
  gcTime: 5 * 60_000,
} as const
const LIBRARY_QUERY_KEYS = {
  playlists: ["playlists"] as const,
  songs: ["songs"] as const,
}

export const honoClient = hc<AppType>(baseUrl)

const encodeParam = (value: string | number) => encodeURIComponent(String(value))

export const uploadSong = (file: File) =>
  parseResponse(
    honoClient.api.songs.upload[":filename"].$post(
      {
        param: {
          filename: encodeParam(file.name),
        },
      },
      {
        headers: {
          "Content-Type": file.type || "application/octet-stream",
        },
        init: {
          body: file,
        },
      },
    ),
  )

export const recordListen = (payload: {
  track_id: number
  playlist_id?: number
}) =>
  parseResponse(
    honoClient.api.analytics.listen.$post({
      json: payload,
    }),
  )

export const getStreamUrl = (id: number) =>
  honoClient.api.songs[":id"].stream
    .$url({ param: { id: encodeParam(id) } })
    .toString()

const playlistsQueryOptions = () => ({
  queryKey: LIBRARY_QUERY_KEYS.playlists,
  queryFn: () => parseResponse(honoClient.api.playlists.$get()),
  ...DEFAULT_QUERY_OPTIONS,
})

const songsQueryOptions = (playlist: ActivePlaylist) => ({
  queryKey: [...LIBRARY_QUERY_KEYS.songs, getPlaylistKey(playlist)] as const,
  queryFn: async () => {
    if (playlist.type === "custom") {
      const data = await parseResponse(
        honoClient.api.playlists[":id"].tracks.$get({
          param: { id: encodeParam(playlist.id) },
        }),
      )
      return data.tracks ?? []
    }

    const query = {
      sort: playlist.sort,
      ...(playlist.days == null ? {} : { days: String(playlist.days) }),
    }
    const data = await parseResponse(honoClient.api.songs.$get({ query }))
    return data.songs ?? []
  },
  ...DEFAULT_QUERY_OPTIONS,
})

export const usePlaylistsQuery = () => useQuery(playlistsQueryOptions())

export const useSongsQuery = (playlist: ActivePlaylist) =>
  useQuery(songsQueryOptions(playlist))

export const prefetchSongsQuery = (
  queryClient: QueryClient,
  playlist: ActivePlaylist,
) => queryClient.prefetchQuery(songsQueryOptions(playlist))

export const invalidateSongsQuery = (queryClient: QueryClient) =>
  queryClient.invalidateQueries({ queryKey: LIBRARY_QUERY_KEYS.songs })

export const invalidatePlaylistsQuery = (queryClient: QueryClient) =>
  queryClient.invalidateQueries({ queryKey: LIBRARY_QUERY_KEYS.playlists })

export const invalidateLibraryQueries = (queryClient: QueryClient) =>
  Promise.all([
    invalidateSongsQuery(queryClient),
    invalidatePlaylistsQuery(queryClient),
  ])

export const useUploadSongMutation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: uploadSong,
    onSuccess: async () => {
      await invalidateSongsQuery(queryClient)
    },
  })
}

export const useCreatePlaylistMutation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (name: string) =>
      parseResponse(
        honoClient.api.playlists.$post({
          json: { name },
        }),
      ),
    onSuccess: async () => {
      await invalidatePlaylistsQuery(queryClient)
    },
  })
}

export const useAddTrackToPlaylistMutation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      playlistId,
      trackId,
    }: {
      playlistId: number
      trackId: number
    }) =>
      parseResponse(
        honoClient.api.playlists[":id"].tracks.$post({
          param: { id: encodeParam(playlistId) },
          json: { trackId },
        }),
      ),
    onSuccess: async () => {
      await invalidateLibraryQueries(queryClient)
    },
  })
}

export const useRemoveTrackFromPlaylistMutation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      playlistId,
      trackId,
    }: {
      playlistId: number
      trackId: number
    }) =>
      parseResponse(
        honoClient.api.playlists[":id"].tracks[":trackId"].$delete({
          param: {
            id: encodeParam(playlistId),
            trackId: encodeParam(trackId),
          },
        }),
      ),
    onSuccess: async () => {
      await invalidateLibraryQueries(queryClient)
    },
  })
}

export const useDeleteSongMutation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (trackId: number) =>
      parseResponse(
        honoClient.api.songs[":id"].$delete({
          param: { id: encodeParam(trackId) },
        }),
      ),
    onSuccess: async () => {
      await invalidateLibraryQueries(queryClient)
    },
  })
}
