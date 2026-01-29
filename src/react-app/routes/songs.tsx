import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import {
  Gauge,
  MoreVertical,
  Pause,
  Play,
  Repeat,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume2,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { SidebarTrigger } from "@/components/ui/sidebar"
import {
  addTrackToPlaylist,
  fetchPlaylists,
  honoClient,
  recordListen,
} from "@/react-app/lib/api"
import { usePlayer, type ActivePlaylist } from "@/react-app/lib/player"
import type {
  PlaylistSong,
  PlaylistTracksPayload,
  SongsPayload,
} from "@/react-app/lib/types"

export const Route = createFileRoute('/songs')({
  component: AllSongs,
})

const fetchSongsForPlaylist = async (
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

  const query: Record<string, string> = {}
  if (playlist.sort) {
    query.sort = playlist.sort
  }
  if (playlist.days) {
    query.days = String(playlist.days)
  }

  const response = await honoClient.api.songs.$get(
    Object.keys(query).length ? { query } : undefined,
  )

  if (!response.ok) {
    throw new Error(`Failed to load songs (${response.status})`)
  }

  const data = (await response.json()) as SongsPayload
  return data.songs ?? []
}

const getStreamUrl = (id: number) =>
  honoClient.api.songs[":id"].stream
    .$url({ param: { id: encodeURIComponent(String(id)) } })
    .toString()

const formatDuration = (seconds?: number | null) => {
  if (!seconds || seconds <= 0) {
    return "--"
  }

  const rounded = Math.round(seconds)
  const minutes = Math.floor(rounded / 60)
  const remaining = rounded % 60
  return `${minutes}:${remaining.toString().padStart(2, "0")}`
}

const formatListeningTime = (seconds?: number | null) => {
  if (!seconds || seconds <= 0) {
    return "--"
  }

  const rounded = Math.round(seconds)
  const hours = Math.floor(rounded / 3600)
  const minutes = Math.floor((rounded % 3600) / 60)
  const remaining = rounded % 60

  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }

  if (minutes > 0) {
    return `${minutes}m ${remaining}s`
  }

  return `${remaining}s`
}

const formatTime = (value?: number | null) => {
  if (!value || value <= 0) {
    return "0:00"
  }

  const rounded = Math.floor(value)
  const minutes = Math.floor(rounded / 60)
  const remaining = rounded % 60
  return `${minutes}:${remaining.toString().padStart(2, "0")}`
}

const formatDate = (value?: string | null) => {
  if (!value) {
    return "--"
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return "--"
  }

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(date)
}

const getSongTitle = (song: PlaylistSong) => {
  const title = song.title?.trim()
  return title ? title : song.filename
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
  songs: PlaylistSong[],
  shuffle: boolean,
  currentSongId: number | null,
) => {
  const ids = songs.map((song) => song.id)
  if (!shuffle) {
    const index = currentSongId ? ids.indexOf(currentSongId) : 0
    return { queue: ids, index: index >= 0 ? index : 0 }
  }

  const shuffled = shuffleArray(ids)
  if (currentSongId && shuffled.includes(currentSongId)) {
    return {
      queue: [currentSongId, ...shuffled.filter((id) => id !== currentSongId)],
      index: 0,
    }
  }

  return { queue: shuffled, index: 0 }
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max)

const readStoredNumber = (key: string, fallback: number) => {
  if (typeof window === "undefined") {
    return fallback
  }
  const stored = window.localStorage.getItem(key)
  if (!stored) {
    return fallback
  }
  const parsed = Number(stored)
  return Number.isFinite(parsed) ? parsed : fallback
}

const readStoredBoolean = (key: string, fallback: boolean) => {
  if (typeof window === "undefined") {
    return fallback
  }
  const stored = window.localStorage.getItem(key)
  if (stored === null) {
    return fallback
  }
  return stored === "true"
}

function AllSongs() {
  const { activePlaylist } = usePlayer()
  const queryClient = useQueryClient()
  const [playbackPlaylist, setPlaybackPlaylist] =
    useState<ActivePlaylist>(activePlaylist)
  const [currentSongId, setCurrentSongId] = useState<number | null>(null)
  const [queueIndex, setQueueIndex] = useState(0)
  const [playQueue, setPlayQueue] = useState<number[]>([])
  const [isPlaying, setIsPlaying] = useState(false)
  const [volume, setVolume] = useState(() =>
    clamp(readStoredNumber("player.volume", 1), 0, 1),
  )
  const [playbackRate, setPlaybackRate] = useState(() =>
    clamp(readStoredNumber("player.playbackRate", 1), 0.5, 1.5),
  )
  const [shuffle, setShuffle] = useState(() =>
    readStoredBoolean("player.shuffle", false),
  )
  const [repeat, setRepeat] = useState(() =>
    readStoredBoolean("player.repeat", false),
  )
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [isSeeking, setIsSeeking] = useState(false)
  const [openMenuSongId, setOpenMenuSongId] = useState<number | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [listeningDeltas, setListeningDeltas] = useState<Record<number, number>>(
    {},
  )
  const [menuAnchor, setMenuAnchor] = useState<DOMRect | null>(null)
  const [menuPosition, setMenuPosition] = useState<{ left: number; top: number } | null>(
    null,
  )
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const listenIntervalRef = useRef<number | null>(null)
  const currentSongIdRef = useRef<number | null>(null)
  const isPlayingRef = useRef(false)
  const shouldAutoPlayRef = useRef(false)
  const menuRef = useRef<HTMLDivElement | null>(null)

  const playlistKey =
    activePlaylist.type === "custom"
      ? `custom:${activePlaylist.id}`
      : `smart:${activePlaylist.id}`
  const playbackPlaylistKey =
    playbackPlaylist.type === "custom"
      ? `custom:${playbackPlaylist.id}`
      : `smart:${playbackPlaylist.id}`

  const {
    data: songs = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["songs", playlistKey],
    queryFn: () => fetchSongsForPlaylist(activePlaylist),
  })
  const { data: playbackSongs = [] } = useQuery({
    queryKey: ["playback-songs", playbackPlaylistKey],
    queryFn: () => fetchSongsForPlaylist(playbackPlaylist),
  })
  const {
    data: playlistsResponse,
    isLoading: playlistsLoading,
    isError: playlistsError,
  } = useQuery({
    queryKey: ["playlists"],
    queryFn: fetchPlaylists,
  })
  const playlists = (playlistsResponse as {
    playlists?: { id: number; name: string }[]
  })?.playlists ?? []
  const addToPlaylistMutation = useMutation({
    mutationFn: ({
      playlistId,
      trackId,
    }: {
      playlistId: number
      trackId: number
    }) => addTrackToPlaylist(playlistId, trackId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["songs"] })
      queryClient.invalidateQueries({ queryKey: ["playback-songs"] })
      queryClient.invalidateQueries({ queryKey: ["playlists"] })
    },
  })

  const currentSong = useMemo(() => {
    if (!currentSongId) {
      return null
    }
    return (
      playbackSongs.find((song) => song.id === currentSongId) ??
      songs.find((song) => song.id === currentSongId) ??
      null
    )
  }, [playbackSongs, songs, currentSongId])
  const baseListeningSeconds = (song: PlaylistSong) => {
    if (activePlaylist.type === "smart" && activePlaylist.days) {
      return "window_seconds" in song
        ? (song.window_seconds as number | null)
        : null
    }

    return "seconds_listened" in song
      ? (song.seconds_listened as number | null)
      : null
  }
  const displayListeningSeconds = (song: PlaylistSong) => {
    const base = baseListeningSeconds(song) ?? 0
    const delta = listeningDeltas[song.id] ?? 0
    return base + delta
  }
  const normalizedSearch = searchQuery.trim().toLowerCase()
  const filteredSongs = useMemo(() => {
    if (!normalizedSearch) {
      return songs
    }

    const matches = (value?: string | null) =>
      Boolean(value && value.toLowerCase().includes(normalizedSearch))

    return songs.filter((song) => {
      const title = getSongTitle(song)
      return (
        matches(title) ||
        matches(song.artist ?? null) ||
        matches(song.album ?? null)
      )
    })
  }, [songs, normalizedSearch])
  const isPopularSort =
    activePlaylist.type === "smart" && activePlaylist.sort === "popular"
  const orderedSongs = useMemo(() => {
    if (!isPopularSort) {
      return filteredSongs
    }

    return [...filteredSongs].sort(
      (first, second) =>
        displayListeningSeconds(second) - displayListeningSeconds(first),
    )
  }, [filteredSongs, isPopularSort, listeningDeltas])
  const hasSearch = normalizedSearch.length > 0

  useEffect(() => {
    if (!currentSongId) {
      setPlaybackPlaylist(activePlaylist)
    }
  }, [activePlaylist, currentSongId])

  useEffect(() => {
    setListeningDeltas({})
  }, [playlistKey])

  useEffect(() => {
    currentSongIdRef.current = currentSongId
  }, [currentSongId])

  useEffect(() => {
    isPlayingRef.current = isPlaying
  }, [isPlaying])

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("player.volume", String(volume))
    }
  }, [volume])

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("player.playbackRate", String(playbackRate))
    }
  }, [playbackRate])

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("player.shuffle", String(shuffle))
    }
  }, [shuffle])

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("player.repeat", String(repeat))
    }
  }, [repeat])

  useEffect(() => {
    if (!playbackSongs.length) {
      setPlayQueue([])
      setQueueIndex(0)
      setCurrentTime(0)
      setDuration(0)
      return
    }

    const { queue, index } = buildQueue(
      playbackSongs,
      shuffle,
      currentSongIdRef.current,
    )
    setPlayQueue(queue)
    setQueueIndex(index)

    if (currentSongIdRef.current && !queue.includes(currentSongIdRef.current)) {
      // Only explicit song selection should switch playback.
      shouldAutoPlayRef.current = false
    }
  }, [playbackSongs, shuffle])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) {
      return
    }

    if (!currentSongId) {
      audio.pause()
      setCurrentTime(0)
      setDuration(0)
      return
    }

    audio.load()
    const shouldPlay =
      shouldAutoPlayRef.current || isPlayingRef.current
    shouldAutoPlayRef.current = false
    if (shouldPlay) {
      audio
        .play()
        .then(() => {
          setIsPlaying(true)
        })
        .catch(() => {
          // Autoplay can be blocked; controls allow manual start.
        })
    }
  }, [currentSongId])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) {
      return
    }

    audio.volume = clamp(volume, 0, 1)
  }, [volume])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) {
      return
    }

    const clampedRate = clamp(playbackRate, 0.5, 1.5)
    audio.playbackRate = clampedRate
    audio.defaultPlaybackRate = clampedRate

    const audioElement = audio as HTMLAudioElement & {
      preservesPitch?: boolean
      mozPreservesPitch?: boolean
      webkitPreservesPitch?: boolean
    }
    if (typeof audioElement.preservesPitch === "boolean") {
      audioElement.preservesPitch = false
    }
    if (typeof audioElement.mozPreservesPitch === "boolean") {
      audioElement.mozPreservesPitch = false
    }
    if (typeof audioElement.webkitPreservesPitch === "boolean") {
      audioElement.webkitPreservesPitch = false
    }
  }, [playbackRate])

  useEffect(() => {
    if (!currentSongId || !isPlaying) {
      if (listenIntervalRef.current) {
        window.clearInterval(listenIntervalRef.current)
        listenIntervalRef.current = null
      }
      return
    }

    const playlistId =
      playbackPlaylist.type === "custom" ? playbackPlaylist.id : undefined

    const tick = () => {
      void recordListen({
        track_id: currentSongId,
        playlist_id: playlistId,
      }).catch(() => {
        // Listening analytics are best-effort.
      })
      setListeningDeltas((previous) => ({
        ...previous,
        [currentSongId]: (previous[currentSongId] ?? 0) + 1,
      }))
    }

    tick()
    listenIntervalRef.current = window.setInterval(tick, 1000)

    return () => {
      if (listenIntervalRef.current) {
        window.clearInterval(listenIntervalRef.current)
        listenIntervalRef.current = null
      }
    }
  }, [currentSongId, isPlaying, playbackPlaylist.type, playbackPlaylist.id])

  const handleSelectSong = (song: PlaylistSong) => {
    if (currentSongId === song.id && audioRef.current) {
      audioRef.current.currentTime = 0
      shouldAutoPlayRef.current = true
      audioRef.current.play().catch(() => {
        // Autoplay can be blocked; controls allow manual start.
      })
      return
    }

    setPlaybackPlaylist(activePlaylist)
    const { queue, index } = buildQueue(songs, shuffle, song.id)
    setPlayQueue(queue)
    setQueueIndex(index)

    shouldAutoPlayRef.current = true
    setCurrentSongId(song.id)
  }

  const closeMenu = () => {
    setOpenMenuSongId(null)
    setMenuAnchor(null)
    setMenuPosition(null)
  }

  useLayoutEffect(() => {
    if (!menuAnchor || !menuRef.current) {
      return
    }

    const menu = menuRef.current
    const { innerWidth, innerHeight } = window
    const padding = 8
    const rect = menu.getBoundingClientRect()
    const left = clamp(
      menuAnchor.right - rect.width,
      padding,
      innerWidth - rect.width - padding,
    )

    let top = menuAnchor.top - rect.height - padding
    if (top < padding) {
      top = menuAnchor.bottom + padding
    }
    if (top + rect.height > innerHeight - padding) {
      top = Math.max(padding, innerHeight - rect.height - padding)
    }

    setMenuPosition({ left, top })
  }, [menuAnchor, openMenuSongId])

  useEffect(() => {
    if (!openMenuSongId) {
      return
    }

    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null
      if (!target) {
        return
      }
      if (menuRef.current?.contains(target)) {
        return
      }
      if (target.closest("[data-menu-trigger='true']")) {
        return
      }
      closeMenu()
    }

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeMenu()
      }
    }

    const handleScroll = () => closeMenu()
    const handleResize = () => closeMenu()

    window.addEventListener("mousedown", handleClick)
    window.addEventListener("keydown", handleKey)
    window.addEventListener("scroll", handleScroll, true)
    window.addEventListener("resize", handleResize)
    return () => {
      window.removeEventListener("mousedown", handleClick)
      window.removeEventListener("keydown", handleKey)
      window.removeEventListener("scroll", handleScroll, true)
      window.removeEventListener("resize", handleResize)
    }
  }, [openMenuSongId])

  const handleTogglePlay = () => {
    const audio = audioRef.current
    if (!audio) {
      return
    }

    if (!currentSongId) {
      if (!songs.length) {
        return
      }

      const firstSong = songs[0]
      if (!firstSong) {
        return
      }

      setPlaybackPlaylist(activePlaylist)
      const { queue, index } = buildQueue(songs, shuffle, firstSong.id)
      setPlayQueue(queue)
      setQueueIndex(index)
      shouldAutoPlayRef.current = true
      setCurrentSongId(firstSong.id)
      return
    }

    if (audio.paused) {
      audio.play().catch(() => {
        // Autoplay can be blocked; controls allow manual start.
      })
      return
    }

    audio.pause()
  }

  const handleSeek = (value: number) => {
    const audio = audioRef.current
    if (!audio || !Number.isFinite(value)) {
      return
    }
    const nextTime = clamp(value, 0, duration || audio.duration || 0)
    audio.currentTime = nextTime
    setCurrentTime(nextTime)
  }

  const handleNext = () => {
    if (!playQueue.length) {
      return
    }

    const nextIndex = (queueIndex + 1) % playQueue.length
    const nextId = playQueue[nextIndex]
    shouldAutoPlayRef.current = true
    setQueueIndex(nextIndex)
    setCurrentSongId(nextId)
  }

  const handlePrevious = () => {
    if (!playQueue.length) {
      return
    }

    const prevIndex =
      (queueIndex - 1 + playQueue.length) % playQueue.length
    const prevId = playQueue[prevIndex]
    shouldAutoPlayRef.current = true
    setQueueIndex(prevIndex)
    setCurrentSongId(prevId)
  }

  const handleEnded = () => {
    if (repeat && audioRef.current) {
      audioRef.current.currentTime = 0
      shouldAutoPlayRef.current = true
      audioRef.current.play().catch(() => {
        // Autoplay can be blocked; controls allow manual start.
      })
      return
    }

    handleNext()
  }

  return (
    <div
      className="flex h-svh flex-1 flex-col overflow-y-scroll"
      style={{ scrollbarGutter: "stable" }}
    >
      <div className="space-y-6 p-6 pb-32">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-2xl font-bold">{activePlaylist.name}</h1>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="text-sm text-muted-foreground">
              {isLoading
                ? "Loading songs..."
                : hasSearch
                  ? `${filteredSongs.length} of ${songs.length} songs`
                  : `${songs.length} songs`}
            </div>
            <Input
              type="search"
              placeholder="Search playlist"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="w-56 sm:w-64"
              aria-label="Search playlist"
            />
          </div>
        </div>
        {isLoading ? (
          <div className="text-muted-foreground rounded-lg border p-6">
            Loading your songs...
          </div>
        ) : isError ? (
          <div className="border-destructive/40 bg-destructive/5 rounded-lg border p-6">
            <p className="text-destructive text-sm">
              {error instanceof Error ? error.message : "Failed to load songs."}
            </p>
            <Button className="mt-4" variant="outline" onClick={() => refetch()}>
              Try again
            </Button>
          </div>
        ) : songs.length === 0 ? (
          <div className="text-muted-foreground rounded-lg border p-6">
            {activePlaylist.type === "custom"
              ? "This playlist is empty. Add songs to get started."
              : activePlaylist.type === "smart" && activePlaylist.days
                ? `No songs played in the last ${activePlaylist.days} days.`
                : "No songs yet. Upload a track to get started."}
          </div>
        ) : filteredSongs.length === 0 ? (
          <div className="text-muted-foreground rounded-lg border p-6">
            No songs match "{searchQuery.trim()}".
          </div>
        ) : (
          <div className="rounded-lg border [overflow-anchor:none]">
            <Table containerClassName="overflow-visible">
              <TableHeader className="sticky top-0 z-10 bg-card">
                <TableRow className="bg-card">
                  <TableHead>Title</TableHead>
                  <TableHead>Artist</TableHead>
                  <TableHead>Album</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>
                    {activePlaylist.type === "smart" && activePlaylist.days
                      ? `Time listened (${activePlaylist.days}d)`
                      : "Time listened"}
                  </TableHead>
                  <TableHead>Last played</TableHead>
                  <TableHead>Date added</TableHead>
                  <TableHead className="w-12 text-right"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orderedSongs.map((song) => (
                  <TableRow
                    key={song.id}
                    className="cursor-pointer select-none focus-visible:outline-none"
                    data-state={currentSongId === song.id ? "selected" : undefined}
                    onClick={() => handleSelectSong(song)}
                  >
                    <TableCell className="font-medium">
                      {getSongTitle(song)}
                    </TableCell>
                    <TableCell>{song.artist ?? "--"}</TableCell>
                    <TableCell>{song.album ?? "--"}</TableCell>
                    <TableCell>{formatDuration(song.duration)}</TableCell>
                    <TableCell>
                      {formatListeningTime(displayListeningSeconds(song))}
                    </TableCell>
                    <TableCell>
                      {formatDate(
                        "last_played" in song
                          ? (song.last_played as string | null)
                          : null,
                      )}
                    </TableCell>
                    <TableCell>{formatDate(song.uploaded_at)}</TableCell>
                    <TableCell>
                      <div onClick={(event) => event.stopPropagation()}>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          data-menu-trigger="true"
                          onClick={(event) => {
                            event.stopPropagation()
                            if (openMenuSongId === song.id) {
                              closeMenu()
                              return
                            }
                            const rect = event.currentTarget.getBoundingClientRect()
                            setMenuAnchor(rect)
                            setOpenMenuSongId(song.id)
                          }}
                          aria-haspopup="menu"
                          aria-expanded={openMenuSongId === song.id}
                          aria-label="Song actions"
                        >
                          <MoreVertical />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
      {openMenuSongId !== null && menuAnchor
        ? createPortal(
          <div
            ref={menuRef}
            className="border-border bg-popover text-popover-foreground fixed z-50 min-w-[11rem] rounded-md border p-1 shadow-lg"
            role="menu"
            style={
              menuPosition
                ? { left: menuPosition.left, top: menuPosition.top }
                : { left: menuAnchor.left, top: menuAnchor.bottom + 8 }
            }
            onClick={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <div className="flex flex-col">
              {playlistsLoading ? (
                <div className="text-muted-foreground px-2 py-1.5 text-xs">
                  Loading playlists...
                </div>
              ) : playlistsError ? (
                <div className="text-muted-foreground px-2 py-1.5 text-xs">
                  Failed to load playlists
                </div>
              ) : playlists.length === 0 ? (
                <div className="text-muted-foreground px-2 py-1.5 text-xs">
                  No playlists yet
                </div>
              ) : (
                playlists.map((playlist) => (
                  <button
                    key={playlist.id}
                    type="button"
                    className="hover:bg-accent hover:text-accent-foreground block w-full rounded-sm px-2 py-1.5 text-left text-xs"
                    role="menuitem"
                    onClick={(event) => {
                      event.stopPropagation()
                      addToPlaylistMutation.mutate({
                        playlistId: playlist.id,
                        trackId: openMenuSongId,
                      })
                      closeMenu()
                    }}
                  >
                    Add to {playlist.name}
                  </button>
                ))
              )}
            </div>
          </div>,
          document.body,
        )
        : null}
      <div className="sticky bottom-0 z-10 mt-auto px-6 pb-6">
        <div className="rounded-lg border bg-card p-4">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:items-center">
            <div className="min-w-0">
              <p className="truncate font-medium">
                {currentSong ? getSongTitle(currentSong) : "Select a song"}
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Button
                type="button"
                variant={shuffle ? "default" : "outline"}
                size="icon"
                onClick={() => setShuffle((value) => !value)}
                aria-pressed={shuffle}
                aria-label="Shuffle"
                className={shuffle ? "shadow-[0_0_0_2px_rgba(255,255,255,0.35)]" : undefined}
              >
                <Shuffle />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handlePrevious}
                disabled={playQueue.length === 0}
                aria-label="Previous song"
              >
                <SkipBack />
              </Button>
              <Button
                type="button"
                variant="default"
                size="icon"
                onClick={handleTogglePlay}
                disabled={songs.length === 0}
                aria-label={isPlaying ? "Pause" : "Play"}
              >
                {isPlaying ? <Pause /> : <Play />}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleNext}
                disabled={playQueue.length === 0}
                aria-label="Next song"
              >
                <SkipForward />
              </Button>
              <Button
                type="button"
                variant={repeat ? "default" : "outline"}
                size="icon"
                onClick={() => setRepeat((value) => !value)}
                aria-pressed={repeat}
                aria-label="Repeat song"
                className={repeat ? "shadow-[0_0_0_2px_rgba(255,255,255,0.35)]" : undefined}
              >
                <Repeat />
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-3 lg:justify-end">
              <label className="flex items-center gap-2 text-[10px] text-muted-foreground">
                <Gauge className="size-4" />
                <input
                  type="range"
                  min={0.5}
                  max={1.5}
                  step={0.01}
                  value={playbackRate}
                  onChange={(event) =>
                    setPlaybackRate(
                      clamp(Number(event.target.value), 0.5, 1.5),
                    )
                  }
                  className="accent-primary w-24"
                />
                <span className="w-8 text-right">
                  {Math.round(playbackRate * 100)}%
                </span>
              </label>
              <label className="flex items-center gap-2 text-[10px] text-muted-foreground">
                <Volume2 className="size-4" />
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={volume}
                  onChange={(event) =>
                    setVolume(clamp(Number(event.target.value), 0, 1))
                  }
                  className="accent-primary w-24"
                />
                <span className="w-8 text-right">
                  {Math.round(volume * 100)}%
                </span>
              </label>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="w-10 text-right">{formatTime(currentTime)}</span>
            <input
              type="range"
              min={0}
              max={duration || 0}
              step={0.25}
              value={Math.min(currentTime, duration || 0)}
              onPointerDown={() => setIsSeeking(true)}
              onPointerUp={() => setIsSeeking(false)}
              onChange={(event) => handleSeek(Number(event.target.value))}
              className="accent-primary w-full"
              disabled={!currentSongId || !duration}
              aria-label="Seek"
            />
            <span className="w-10">{formatTime(duration)}</span>
          </div>
          <audio
            ref={audioRef}
            preload="metadata"
            src={currentSongId ? getStreamUrl(currentSongId) : undefined}
            onPlay={() => setIsPlaying(true)}
            onPause={() => {
              setIsPlaying(false)
              shouldAutoPlayRef.current = false
            }}
            onTimeUpdate={(event) => {
              if (isSeeking) {
                return
              }
              const target = event.currentTarget
              setCurrentTime(target.currentTime || 0)
            }}
            onLoadedMetadata={(event) => {
              const nextDuration = event.currentTarget.duration
              setDuration(Number.isFinite(nextDuration) ? nextDuration : 0)
            }}
            onEnded={handleEnded}
          />
        </div>
      </div>
    </div>
  )
}
