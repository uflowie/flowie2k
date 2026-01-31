import { recordListen } from "@/react-app/lib/api"
import { usePlaybackStore } from "@/react-app/lib/playback-store"

const TRACKER_KEY = "__flowieListenTrackerStarted"

type PlaybackSnapshot = {
  currentSongId: number | null
  isPlaying: boolean
  playlistId: number | undefined
}

export const startListenTracker = () => {
  if (typeof window === "undefined") {
    return
  }

  const windowAny = window as typeof window & {
    [TRACKER_KEY]?: boolean
  }
  if (windowAny[TRACKER_KEY]) {
    return
  }
  windowAny[TRACKER_KEY] = true

  let intervalId: number | null = null
  const state: PlaybackSnapshot = {
    currentSongId: null,
    isPlaying: false,
    playlistId: undefined,
  }

  const stopInterval = () => {
    if (intervalId) {
      window.clearInterval(intervalId)
      intervalId = null
    }
  }

  const tick = () => {
    if (!state.currentSongId || !state.isPlaying) {
      return
    }
    void recordListen({
      track_id: state.currentSongId,
      playlist_id: state.playlistId,
    }).catch(() => {
      // Listening analytics are best-effort.
    })
  }

  const updateState = (snapshot: ReturnType<typeof usePlaybackStore.getState>) => {
    const nextPlaylistId =
      snapshot.playbackPlaylist.type === "custom"
        ? snapshot.playbackPlaylist.id
        : undefined
    const nextSongId = snapshot.currentSongId
    const nextIsPlaying = snapshot.isPlaying
    const shouldRun = Boolean(nextSongId && nextIsPlaying)

    const changed =
      state.currentSongId !== nextSongId ||
      state.isPlaying !== nextIsPlaying ||
      state.playlistId !== nextPlaylistId

    state.currentSongId = nextSongId
    state.isPlaying = nextIsPlaying
    state.playlistId = nextPlaylistId

    if (!shouldRun) {
      stopInterval()
      return
    }

    if (changed) {
      stopInterval()
      intervalId = window.setInterval(tick, 1000)
    }
  }

  const unsubscribe = usePlaybackStore.subscribe(updateState)
  updateState(usePlaybackStore.getState())

  window.addEventListener(
    "beforeunload",
    () => {
      stopInterval()
      unsubscribe()
    },
    { once: true },
  )
}
