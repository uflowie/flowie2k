import { honoClient } from "@/react-app/lib/api"
import type { ActivePlaylist } from "@/react-app/lib/playback-store"
import type {
  PlaylistSong,
  PlaylistTracksPayload,
} from "@/react-app/lib/types"

export const fetchSongsForPlaylist = async (
  playlist: ActivePlaylist,
): Promise<PlaylistSong[]> => {
  if (playlist.type === "custom") {
    const response = await honoClient.api.playlists[":id"].tracks.$get({
      param: { id: encodeURIComponent(String(playlist.id)) },
    })

    if (!response.ok) {
      throw new Error(`Failed to load playlist (${response.status})`)
    }

    const data = (await response.json()) as PlaylistTracksPayload
    return data.tracks ?? []
  }

  const query = {
    sort: playlist.sort,
    ...(playlist.days == null ? {} : { days: String(playlist.days) })
  }

  const response = await honoClient.api.songs.$get({ query })

  if (!response.ok) {
    throw new Error(`Failed to load songs (${response.status})`)
  }

  const data = (await response.json())
  return data.songs ?? []
}

export const getStreamUrl = (id: number) =>
  honoClient.api.songs[":id"].stream
    .$url({ param: { id: encodeURIComponent(String(id)) } })
    .toString()
