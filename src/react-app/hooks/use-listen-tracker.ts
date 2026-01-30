import { useEffect, useRef } from "react"
import { recordListen } from "@/react-app/lib/api"
import { usePlaybackStore } from "@/react-app/lib/playback-store"

type ListenTrackerOptions = {
  onListenDelta?: (trackId: number) => void
}

export function useListenTracker({ onListenDelta }: ListenTrackerOptions) {
  const currentSongId = usePlaybackStore((state) => state.currentSongId)
  const isPlaying = usePlaybackStore((state) => state.isPlaying)
  const playbackPlaylist = usePlaybackStore((state) => state.playbackPlaylist)
  const playlistId =
    playbackPlaylist.type === "custom" ? playbackPlaylist.id : undefined
  const intervalRef = useRef<number | null>(null)

  useEffect(() => {
    if (!currentSongId || !isPlaying) {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      return
    }

    const tick = () => {
      void recordListen({
        track_id: currentSongId,
        playlist_id: playlistId,
      }).catch(() => {
        // Listening analytics are best-effort.
      })
      onListenDelta?.(currentSongId)
    }

    tick()
    intervalRef.current = window.setInterval(tick, 1000)

    return () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [currentSongId, isPlaying, playlistId, onListenDelta])
}
