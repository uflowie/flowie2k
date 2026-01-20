import { hc } from "hono/client"

import type { AppType } from "@/worker"

const baseUrl =
  typeof window === "undefined" ? "http://localhost" : window.location.origin

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
