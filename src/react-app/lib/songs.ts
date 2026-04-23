import { encodeParam, honoClient, readJsonOrThrow } from "@/react-app/lib/api"
import type { ActivePlaylist } from "@/react-app/lib/playlists"
import type {
  PlaylistSong,
  PlaylistTracksPayload,
  SongsPayload,
} from "@/react-app/lib/types"

export const getSongTitle = (song: PlaylistSong) => {
  const title = song.title?.trim()
  return title ? title : song.filename
}

export const fetchSongsForPlaylist = async (
  playlist: ActivePlaylist,
): Promise<PlaylistSong[]> => {
  if (playlist.type === "custom") {
    const response = await honoClient.api.playlists[":id"].tracks.$get({
      param: { id: encodeParam(playlist.id) },
    })
    const data = await readJsonOrThrow<PlaylistTracksPayload>(
      response,
      `Failed to load playlist (${response.status})`,
    )
    return data.tracks ?? []
  }

  const query = {
    sort: playlist.sort,
    ...(playlist.days == null ? {} : { days: String(playlist.days) }),
  }

  const response = await honoClient.api.songs.$get({ query })
  const data = await readJsonOrThrow<SongsPayload>(
    response,
    `Failed to load songs (${response.status})`,
  )
  return data.songs ?? []
}

export const getStreamUrl = (id: number) =>
  honoClient.api.songs[":id"].stream
    .$url({ param: { id: encodeParam(id) } })
    .toString()
