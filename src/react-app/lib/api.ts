import { hc } from "hono/client"

import type { AppType } from "@/worker"

const baseUrl = window.location.origin

export const honoClient = hc<AppType>(baseUrl)

export const uploadSong = async (file: File) => {
  const response = await honoClient.api.songs.upload[":filename"].$post(
    {
      param: {
        filename: encodeURIComponent(file.name),
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

  if (!response.ok) {
    let message = `Upload failed (${response.status})`
    try {
      const payload = await response.json()
      if (payload && typeof payload === "object" && "error" in payload) {
        message = String(payload.error)
      }
    } catch {
      // Use default message when the response isn't JSON.
    }

    throw new Error(message)
  }

  return response.json()
}

export const fetchPlaylists = async () => {
  const response = await honoClient.api.playlists.$get()

  if (!response.ok) {
    throw new Error(`Failed to load playlists (${response.status})`)
  }

  return response.json()
}

export const createPlaylist = async (name: string) => {
  const response = await honoClient.api.playlists.$post({
    json: { name },
  })

  if (!response.ok) {
    let message = `Failed to create playlist (${response.status})`
    try {
      const payload = await response.json()
      if (payload && typeof payload === "object" && "error" in payload) {
        message = String(payload.error)
      }
    } catch {
      // Use default message when the response isn't JSON.
    }
    throw new Error(message)
  }

  return response.json()
}

export const addTrackToPlaylist = async (
  playlistId: number,
  trackId: number,
) => {
  const response = await honoClient.api.playlists[":id"].tracks.$post({
    param: { id: encodeURIComponent(String(playlistId)) },
    json: { trackId },
  })

  if (!response.ok) {
    let message = `Failed to add track (${response.status})`
    try {
      const payload = await response.json()
      if (payload && typeof payload === "object" && "error" in payload) {
        message = String(payload.error)
      }
    } catch {
      // Use default message when the response isn't JSON.
    }
    throw new Error(message)
  }

  return response.json()
}

export const removeTrackFromPlaylist = async (
  playlistId: number,
  trackId: number,
) => {
  const response = await honoClient.api.playlists[":id"].tracks[
    ":trackId"
  ].$delete({
    param: {
      id: encodeURIComponent(String(playlistId)),
      trackId: encodeURIComponent(String(trackId)),
    },
  })

  if (!response.ok) {
    let message = `Failed to remove track (${response.status})`
    try {
      const payload = await response.json()
      if (payload && typeof payload === "object" && "error" in payload) {
        message = String(payload.error)
      }
    } catch {
      // Use default message when the response isn't JSON.
    }
    throw new Error(message)
  }

  return response.json()
}

export const deleteSong = async (trackId: number) => {
  const response = await honoClient.api.songs[":id"].$delete({
    param: { id: encodeURIComponent(String(trackId)) },
  })

  if (!response.ok) {
    let message = `Failed to delete song (${response.status})`
    try {
      const payload = await response.json()
      if (payload && typeof payload === "object" && "error" in payload) {
        message = String(payload.error)
      }
    } catch {
      // Use default message when the response isn't JSON.
    }
    throw new Error(message)
  }

  return response.json()
}

export const recordListen = async (payload: {
  track_id: number
  playlist_id?: number
}) => {
  const response = await honoClient.api.analytics.listen.$post({
    json: payload,
  })

  if (!response.ok) {
    throw new Error(`Failed to record listening (${response.status})`)
  }

  return response.json()
}
