import { create } from "zustand"

export type SmartPlaylist = {
  type: "smart"
  id: "all" | "popular-30" | "popular-90" | "popular-365"
  name: string
  sort: "popular" | "recent"
  days?: number
}

export type CustomPlaylist = {
  type: "custom"
  id: number
  name: string
}

export type ActivePlaylist = SmartPlaylist | CustomPlaylist

const defaultPlaylist: SmartPlaylist = {
  type: "smart",
  id: "all",
  name: "All Songs",
  sort: "recent",
}

const readStoredBoolean = (key: string, fallback: boolean) => {
  const stored = window.localStorage.getItem(key)
  if (stored === null) {
    return fallback
  }
  return stored === "true"
}

const shuffleArray = (items: number[]) => {
  const array = [...items]
  for (let index = array.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    const current = array[index]
    array[index] = array[swapIndex]
    array[swapIndex] = current
  }
  return array
}

const buildQueue = (
  songIds: number[],
  shuffle: boolean,
  currentSongId: number | null,
) => {
  if (!shuffle) {
    const index = currentSongId ? songIds.indexOf(currentSongId) : 0
    return { queue: songIds, index: index >= 0 ? index : 0 }
  }

  const shuffled = shuffleArray(songIds)
  if (currentSongId && shuffled.includes(currentSongId)) {
    return {
      queue: [currentSongId, ...shuffled.filter((id) => id !== currentSongId)],
      index: 0,
    }
  }

  return { queue: shuffled, index: 0 }
}

const areIdsEqual = (first: number[], second: number[]) => {
  if (first === second) {
    return true
  }
  if (first.length !== second.length) {
    return false
  }
  return first.every((value, index) => value === second[index])
}

export const getPlaylistKey = (playlist: ActivePlaylist) =>
  playlist.type === "custom"
    ? `custom:${playlist.id}`
    : `smart:${playlist.id}`

type StartPlaybackPayload = {
  playlist: ActivePlaylist
  songIds: number[]
  songId?: number
}

type PlaybackStore = {
  activePlaylist: ActivePlaylist
  playbackPlaylist: ActivePlaylist
  activePlaylistSongIds: number[]
  queueSource: number[]
  queue: number[]
  queueIndex: number
  currentSongId: number | null
  isPlaying: boolean
  shuffle: boolean
  repeat: boolean
  restartToken: number
  setActivePlaylist: (playlist: ActivePlaylist) => void
  setActivePlaylistSongIds: (songIds: number[]) => void
  startPlayback: (payload: StartPlaybackPayload) => void
  restartCurrentSong: () => void
  play: () => void
  pause: () => void
  setIsPlaying: (isPlaying: boolean) => void
  next: () => void
  previous: () => void
  toggleShuffle: () => void
  toggleRepeat: () => void
}

export const usePlaybackStore = create<PlaybackStore>((set, get) => ({
  activePlaylist: defaultPlaylist,
  playbackPlaylist: defaultPlaylist,
  activePlaylistSongIds: [],
  queueSource: [],
  queue: [],
  queueIndex: 0,
  currentSongId: null,
  isPlaying: false,
  shuffle: readStoredBoolean("player.shuffle", false),
  repeat: readStoredBoolean("player.repeat", false),
  restartToken: 0,
  setActivePlaylist: (playlist) =>
    set((state) => {
      if (
        getPlaylistKey(state.activePlaylist) === getPlaylistKey(playlist) &&
        state.activePlaylist.name === playlist.name
      ) {
        return state
      }
      return { activePlaylist: playlist, activePlaylistSongIds: [] }
    }),
  setActivePlaylistSongIds: (songIds) =>
    set((state) => {
      const sameActive = areIdsEqual(state.activePlaylistSongIds, songIds)
      const playbackMatches =
        getPlaylistKey(state.activePlaylist) === getPlaylistKey(state.playbackPlaylist)
      const sameQueueSource = areIdsEqual(state.queueSource, songIds)

      if (sameActive && (!playbackMatches || sameQueueSource)) {
        return state
      }

      const nextState = { activePlaylistSongIds: songIds }
      if (!playbackMatches) {
        return nextState
      }
      if (!songIds.length) {
        return { ...nextState, queueSource: [], queue: [], queueIndex: 0 }
      }
      if (state.shuffle) {
        return { ...nextState, queueSource: songIds }
      }
      const { queue, index } = buildQueue(songIds, state.shuffle, state.currentSongId)
      return { ...nextState, queueSource: songIds, queue, queueIndex: index }
    }),
  startPlayback: ({ playlist, songIds, songId }) => {
    if (!songIds.length) {
      return
    }
    const startId = songId ?? songIds[0] ?? null
    if (!startId) {
      return
    }
    const { queue, index } = buildQueue(songIds, get().shuffle, startId)
    set({
      playbackPlaylist: playlist,
      queueSource: songIds,
      queue,
      queueIndex: index,
      currentSongId: startId,
      isPlaying: true,
    })
  },
  restartCurrentSong: () =>
    set((state) => ({
      restartToken: state.restartToken + 1,
      isPlaying: true,
    })),
  play: () => {
    const state = get()
    if (state.currentSongId) {
      set({ isPlaying: true })
      return
    }
    if (!state.activePlaylistSongIds.length) {
      return
    }
    const startId = state.activePlaylistSongIds[0]
    const { queue, index } = buildQueue(
      state.activePlaylistSongIds,
      state.shuffle,
      startId,
    )
    set({
      playbackPlaylist: state.activePlaylist,
      queueSource: state.activePlaylistSongIds,
      queue,
      queueIndex: index,
      currentSongId: startId,
      isPlaying: true,
    })
  },
  pause: () => set({ isPlaying: false }),
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  next: () => {
    const { queue, queueIndex } = get()
    if (!queue.length) {
      return
    }
    const nextIndex = (queueIndex + 1) % queue.length
    const nextId = queue[nextIndex]
    set({ queueIndex: nextIndex, currentSongId: nextId, isPlaying: true })
  },
  previous: () => {
    const { queue, queueIndex } = get()
    if (!queue.length) {
      return
    }
    const prevIndex = (queueIndex - 1 + queue.length) % queue.length
    const prevId = queue[prevIndex]
    set({ queueIndex: prevIndex, currentSongId: prevId, isPlaying: true })
  },
  toggleShuffle: () =>
    set((state) => {
      const nextShuffle = !state.shuffle
      window.localStorage.setItem("player.shuffle", String(nextShuffle))
      if (!state.queueSource.length) {
        return { shuffle: nextShuffle }
      }
      const { queue, index } = buildQueue(
        state.queueSource,
        nextShuffle,
        state.currentSongId,
      )
      return {
        shuffle: nextShuffle,
        queue,
        queueIndex: index,
      }
    }),
  toggleRepeat: () =>
    set((state) => {
      const nextRepeat = !state.repeat
      window.localStorage.setItem("player.repeat", String(nextRepeat))
      return { repeat: nextRepeat }
    }),
}))
