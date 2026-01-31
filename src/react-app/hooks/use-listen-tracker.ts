import { useEffect, useRef } from "react"
import { recordListen } from "@/react-app/lib/api"
import { usePlaybackStore } from "@/react-app/lib/playback-store"

type ListenTrackerOptions = {
  onListenDelta?: (trackId: number) => void
}

export function useListenTracker({ onListenDelta }: ListenTrackerOptions) {
  const onListenDeltaRef = useRef(onListenDelta)
  const intervalRef = useRef<number | null>(null)
  const stateRef = useRef<{
    currentSongId: number | null
    isPlaying: boolean
    playlistId: number | undefined
  }>({
    currentSongId: null,
    isPlaying: false,
    playlistId: undefined,
  })

  useEffect(() => {
    onListenDeltaRef.current = onListenDelta
  }, [onListenDelta])

  useEffect(() => {
    const stopInterval = () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }

    const tick = () => {
      const { currentSongId, isPlaying, playlistId } = stateRef.current
      if (!currentSongId || !isPlaying) {
        return
      }
      void recordListen({
        track_id: currentSongId,
        playlist_id: playlistId,
      }).catch(() => {
        // Listening analytics are best-effort.
      })
      onListenDeltaRef.current?.(currentSongId)
    }

    const updateState = (state: ReturnType<typeof usePlaybackStore.getState>) => {
      const nextPlaylistId =
        state.playbackPlaylist.type === "custom"
          ? state.playbackPlaylist.id
          : undefined
      const nextSongId = state.currentSongId
      const nextIsPlaying = state.isPlaying
      const shouldRun = Boolean(nextSongId && nextIsPlaying)

      const previous = stateRef.current
      const changed =
        previous.currentSongId !== nextSongId ||
        previous.isPlaying !== nextIsPlaying ||
        previous.playlistId !== nextPlaylistId

      stateRef.current = {
        currentSongId: nextSongId,
        isPlaying: nextIsPlaying,
        playlistId: nextPlaylistId,
      }

      if (!shouldRun) {
        stopInterval()
        return
      }

      if (changed) {
        stopInterval()
        intervalRef.current = window.setInterval(tick, 1000)
      }
    }

    const unsubscribe = usePlaybackStore.subscribe(updateState)
    updateState(usePlaybackStore.getState())

    return () => {
      stopInterval()
      unsubscribe()
    }
  }, [])
}
