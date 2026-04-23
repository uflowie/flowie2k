import type { PlaylistSong } from "@/react-app/lib/types"

export const getSongTitle = (song: PlaylistSong) => {
  const title = song.title?.trim()
  return title ? title : song.filename
}
