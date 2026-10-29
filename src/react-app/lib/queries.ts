import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { fetch } from "void/client";

import { getPlaylistKey, type ActivePlaylist } from "@/react-app/lib/playlists";

const DEFAULT_QUERY_OPTIONS = {
  staleTime: 30_000,
  gcTime: 5 * 60_000,
} as const;
const LIBRARY_QUERY_KEYS = {
  playlists: ["playlists"] as const,
  songs: ["songs"] as const,
};

export const uploadSong = (file: File) =>
  fetch("/api/songs/upload/:filename", {
    method: "POST",
    params: { filename: file.name },
    headers: { "Content-Type": file.type || "application/octet-stream" },
    body: file,
  });

export const recordListen = (payload: { track_id: number; playlist_id?: number }) =>
  fetch("/api/analytics/listen", {
    method: "POST",
    body: payload,
  });

// Plain URLs for <audio>/<img> elements, which can't use fetch().
export const getStreamUrl = (id: number) => `/api/songs/${id}/stream`;

export const getThumbnailUrl = (id: number) => `/api/songs/${id}/thumbnail`;

const playlistsQueryOptions = () => ({
  queryKey: LIBRARY_QUERY_KEYS.playlists,
  queryFn: () => fetch("/api/playlists"),
  ...DEFAULT_QUERY_OPTIONS,
});

const songsQueryOptions = (playlist: ActivePlaylist) => ({
  queryKey: [...LIBRARY_QUERY_KEYS.songs, getPlaylistKey(playlist)] as const,
  queryFn: async () => {
    if (playlist.type === "custom") {
      const data = await fetch("/api/playlists/:id/tracks", {
        params: { id: String(playlist.id) },
      });
      return data.tracks;
    }

    const query = {
      sort: playlist.sort,
      ...(playlist.days == null ? {} : { days: String(playlist.days) }),
    };
    const data = await fetch("/api/songs", { query });
    return data.songs;
  },
  ...DEFAULT_QUERY_OPTIONS,
});

export const usePlaylistsQuery = () => useQuery(playlistsQueryOptions());

export const useSongsQuery = (playlist: ActivePlaylist) => useQuery(songsQueryOptions(playlist));

export const prefetchSongsQuery = (queryClient: QueryClient, playlist: ActivePlaylist) =>
  queryClient.prefetchQuery(songsQueryOptions(playlist));

export const invalidateSongsQuery = (queryClient: QueryClient) =>
  queryClient.invalidateQueries({ queryKey: LIBRARY_QUERY_KEYS.songs });

export const invalidatePlaylistsQuery = (queryClient: QueryClient) =>
  queryClient.invalidateQueries({ queryKey: LIBRARY_QUERY_KEYS.playlists });

export const invalidateLibraryQueries = (queryClient: QueryClient) =>
  Promise.all([invalidateSongsQuery(queryClient), invalidatePlaylistsQuery(queryClient)]);

export const useUploadSongMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: uploadSong,
    onSuccess: async () => {
      await invalidateSongsQuery(queryClient);
    },
  });
};

export const useCreatePlaylistMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (name: string) =>
      fetch("/api/playlists", {
        method: "POST",
        body: { name },
      }),
    onSuccess: async () => {
      await invalidatePlaylistsQuery(queryClient);
    },
  });
};

export const useAddTrackToPlaylistMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ playlistId, trackId }: { playlistId: number; trackId: number }) =>
      fetch("/api/playlists/:id/tracks", {
        method: "POST",
        params: { id: String(playlistId) },
        body: { trackId },
      }),
    onSuccess: async () => {
      await invalidateLibraryQueries(queryClient);
    },
  });
};

export const useRemoveTrackFromPlaylistMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ playlistId, trackId }: { playlistId: number; trackId: number }) =>
      fetch("/api/playlists/:id/tracks/:trackId", {
        method: "DELETE",
        params: { id: String(playlistId), trackId: String(trackId) },
      }),
    onSuccess: async () => {
      await invalidateLibraryQueries(queryClient);
    },
  });
};

export const useDeleteSongMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (trackId: number) =>
      fetch("/api/songs/:id", {
        method: "DELETE",
        params: { id: String(trackId) },
      }),
    onSuccess: async () => {
      await invalidateLibraryQueries(queryClient);
    },
  });
};
