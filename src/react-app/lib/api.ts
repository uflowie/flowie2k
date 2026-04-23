import { hc } from "hono/client"

import type { AppType } from "@/worker"
import type { PlaylistsPayload } from "@/react-app/lib/types"

const baseUrl = window.location.origin

export const honoClient = hc<AppType>(baseUrl)

export const encodeParam = (value: string | number) =>
  encodeURIComponent(String(value))

const readErrorMessage = async (response: Response, fallback: string) => {
  try {
    const payload = (await response.json()) as { error?: unknown }
    if (payload && typeof payload === "object" && "error" in payload) {
      return String(payload.error)
    }
  } catch {
    // Use the fallback when the response body isn't JSON.
  }

  return fallback
}

export const readJsonOrThrow = async <T>(
  response: Response,
  fallback: string,
): Promise<T> => {
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, fallback))
  }

  return response.json() as Promise<T>
}

export const uploadSong = async (file: File) => {
  const response = await honoClient.api.songs.upload[":filename"].$post(
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
  )

  return readJsonOrThrow(response, `Upload failed (${response.status})`)
}

export const fetchPlaylists = async (): Promise<PlaylistsPayload> => {
  const response = await honoClient.api.playlists.$get()
  return readJsonOrThrow(response, `Failed to load playlists (${response.status})`)
}

export const createPlaylist = async (name: string) => {
  const response = await honoClient.api.playlists.$post({
    json: { name },
  })
  return readJsonOrThrow<{ id: number; name: string; message: string }>(
    response,
    `Failed to create playlist (${response.status})`,
  )
}

export const addTrackToPlaylist = async (
  playlistId: number,
  trackId: number,
) => {
  const response = await honoClient.api.playlists[":id"].tracks.$post({
    param: { id: encodeParam(playlistId) },
    json: { trackId },
  })
  return readJsonOrThrow<{ message: string }>(
    response,
    `Failed to add track (${response.status})`,
  )
}

export const removeTrackFromPlaylist = async (
  playlistId: number,
  trackId: number,
) => {
  const response = await honoClient.api.playlists[":id"].tracks[
    ":trackId"
  ].$delete({
    param: {
      id: encodeParam(playlistId),
      trackId: encodeParam(trackId),
    },
  })
  return readJsonOrThrow<{ message: string }>(
    response,
    `Failed to remove track (${response.status})`,
  )
}

export const deleteSong = async (trackId: number) => {
  const response = await honoClient.api.songs[":id"].$delete({
    param: { id: encodeParam(trackId) },
  })
  return readJsonOrThrow<{ message: string }>(
    response,
    `Failed to delete song (${response.status})`,
  )
}

export const recordListen = async (payload: {
  track_id: number
  playlist_id?: number
}) => {
  const response = await honoClient.api.analytics.listen.$post({
    json: payload,
  })
  return readJsonOrThrow<{ success: boolean }>(
    response,
    `Failed to record listening (${response.status})`,
  )
}
