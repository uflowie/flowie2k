import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Slider } from "@/components/ui/slider"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  flexRender,
  getCoreRowModel,
  type ColumnDef,
  useReactTable,
} from "@tanstack/react-table"
import { useVirtualizer } from "@tanstack/react-virtual"
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
  const stored = window.localStorage.getItem(key)
  if (!stored) {
    return fallback
  }
  const parsed = Number(stored)
  return Number.isFinite(parsed) ? parsed : fallback
}

const readStoredBoolean = (key: string, fallback: boolean) => {
  const stored = window.localStorage.getItem(key)
  if (stored === null) {
    return fallback
  }
  return stored === "true"
}

type SortKey =
  | "title"
  | "artist"
  | "album"
  | "duration"
  | "time"
  | "lastPlayed"
  | "dateAdded"

type TableSort = {
  key: SortKey
  direction: "asc" | "desc"
}

type SongsColumnMeta = {
  sortKey?: SortKey
  headerClassName?: string
  cellClassName?: string
}

const getListeningSecondsForPlaylist = (
  song: PlaylistSong,
  playlist: ActivePlaylist,
) => {
  if (playlist.type === "smart" && playlist.days) {
    return "window_seconds" in song
      ? (song.window_seconds as number | null)
      : null
  }

  return "seconds_listened" in song
    ? (song.seconds_listened as number | null)
    : null
}

const getDisplayListeningSeconds = (
  song: PlaylistSong,
  playlist: ActivePlaylist,
  listeningDeltas: Record<number, number>,
) => {
  const base = getListeningSecondsForPlaylist(song, playlist) ?? 0
  const delta = listeningDeltas[song.id] ?? 0
  return base + delta
}

const orderSongsByListening = (
  items: PlaylistSong[],
  playlist: ActivePlaylist,
  listeningDeltas: Record<number, number>,
) =>
  [...items].sort(
    (first, second) =>
      getDisplayListeningSeconds(second, playlist, listeningDeltas) -
      getDisplayListeningSeconds(first, playlist, listeningDeltas),
  )

const applyTableSort = (
  items: PlaylistSong[],
  sort: TableSort,
  playlist: ActivePlaylist,
  listeningDeltas: Record<number, number>,
) => {
  const toDateValue = (value?: string | null) => {
    if (!value) {
      return null
    }
    const time = new Date(value).getTime()
    return Number.isNaN(time) ? null : time
  }

  const getSortValue = (song: PlaylistSong) => {
    switch (sort.key) {
      case "title":
        return getSongTitle(song)
      case "artist":
        return song.artist ?? null
      case "album":
        return song.album ?? null
      case "duration":
        return song.duration ?? null
      case "time":
        return getDisplayListeningSeconds(song, playlist, listeningDeltas)
      case "lastPlayed":
        return "last_played" in song
          ? toDateValue(song.last_played as string | null)
          : null
      case "dateAdded":
        return toDateValue(song.uploaded_at)
      default:
        return null
    }
  }

  const compareValues = (
    first: string | number | null,
    second: string | number | null,
  ) => {
    if (first === null && second === null) {
      return 0
    }
    if (first === null) {
      return 1
    }
    if (second === null) {
      return -1
    }
    if (typeof first === "string" || typeof second === "string") {
      return String(first).localeCompare(String(second), undefined, {
        sensitivity: "base",
      })
    }
    return first - second
  }

  const direction = sort.direction === "asc" ? 1 : -1

  return [...items].sort((first, second) => {
    const result = compareValues(getSortValue(first), getSortValue(second))
    if (result !== 0) {
      return result * direction
    }
    return getSongTitle(first).localeCompare(getSongTitle(second))
  })
}

function AllSongs() {
  const { activePlaylist } = usePlayer()
  const playlistKey =
    activePlaylist.type === "custom"
      ? `custom:${activePlaylist.id}`
      : `smart:${activePlaylist.id}`
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
  const closeMenu = useCallback(() => {
    setOpenMenuSongId(null)
  }, [])
  const [listeningState, setListeningState] = useState(() => ({
    playlistKey,
    deltas: {} as Record<number, number>,
  }))
  const [tableSortState, setTableSortState] = useState<
    (TableSort & { playlistKey: string }) | null
  >(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const listenIntervalRef = useRef<number | null>(null)
  const currentSongIdRef = useRef<number | null>(null)
  const isPlayingRef = useRef(false)
  const shouldAutoPlayRef = useRef(false)
  const tableContainerRef = useRef<HTMLDivElement | null>(null)
  const listeningDeltas = useMemo(
    () =>
      listeningState.playlistKey === playlistKey
        ? listeningState.deltas
        : {},
    [listeningState, playlistKey],
  )
  const tableSort =
    tableSortState?.playlistKey === playlistKey ? tableSortState : null
  const playbackContextPlaylist = currentSongId
    ? playbackPlaylist
    : activePlaylist
  const displayCurrentTime = currentSongId ? currentTime : 0
  const displayDuration = currentSongId ? duration : 0
  const playbackRateValue = useMemo(() => [playbackRate], [playbackRate])
  const volumeValue = useMemo(() => [volume], [volume])
  const seekValue = useMemo(
    () => [Math.min(displayCurrentTime, displayDuration || 0)],
    [displayCurrentTime, displayDuration],
  )
  const playbackPlaylistKey =
    playbackContextPlaylist.type === "custom"
      ? `custom:${playbackContextPlaylist.id}`
      : `smart:${playbackContextPlaylist.id}`

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
    queryFn: () => fetchSongsForPlaylist(playbackContextPlaylist),
  })
  const {
    data: playlistsResponse,
    isLoading: playlistsLoading,
    isError: playlistsError,
  } = useQuery({
    queryKey: ["playlists"],
    queryFn: fetchPlaylists,
  })
  const playlists = useMemo(() => {
    return (playlistsResponse as {
      playlists?: { id: number; name: string }[]
    })?.playlists ?? []
  }, [playlistsResponse])
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
  const isSortablePlaylist =
    activePlaylist.type === "custom" ||
    (activePlaylist.type === "smart" && activePlaylist.id === "all")
  const normalizedSearch = searchQuery.trim().toLowerCase()
  const hasSearch = normalizedSearch.length > 0

  const activeOrderedSongs = useMemo(() => {
    if (activePlaylist.type === "smart" && activePlaylist.sort === "popular") {
      return orderSongsByListening(songs, activePlaylist, listeningDeltas)
    }
    return songs
  }, [songs, activePlaylist, listeningDeltas])

  const playbackOrderedSongs = useMemo(() => {
    if (
      playbackContextPlaylist.type === "smart" &&
      playbackContextPlaylist.sort === "popular"
    ) {
      return orderSongsByListening(
        playbackSongs,
        playbackContextPlaylist,
        listeningDeltas,
      )
    }
    return playbackSongs
  }, [playbackSongs, playbackContextPlaylist, listeningDeltas])

  useEffect(() => {
    currentSongIdRef.current = currentSongId
  }, [currentSongId])

  useEffect(() => {
    isPlayingRef.current = isPlaying
  }, [isPlaying])

  useEffect(() => {
    window.localStorage.setItem("player.volume", String(volume))
  }, [volume])

  useEffect(() => {
    window.localStorage.setItem("player.playbackRate", String(playbackRate))
  }, [playbackRate])

  useEffect(() => {
    window.localStorage.setItem("player.shuffle", String(shuffle))
  }, [shuffle])

  useEffect(() => {
    window.localStorage.setItem("player.repeat", String(repeat))
  }, [repeat])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) {
      return
    }

    if (!currentSongId) {
      audio.pause()
      shouldAutoPlayRef.current = false
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
      playbackContextPlaylist.type === "custom"
        ? playbackContextPlaylist.id
        : undefined

    const tick = () => {
      void recordListen({
        track_id: currentSongId,
        playlist_id: playlistId,
      }).catch(() => {
        // Listening analytics are best-effort.
      })
      setListeningState((previous) => {
        if (previous.playlistKey !== playlistKey) {
          return {
            playlistKey,
            deltas: { [currentSongId]: 1 },
          }
        }
        return {
          playlistKey,
          deltas: {
            ...previous.deltas,
            [currentSongId]: (previous.deltas[currentSongId] ?? 0) + 1,
          },
        }
      })
    }

    tick()
    listenIntervalRef.current = window.setInterval(tick, 1000)

    return () => {
      if (listenIntervalRef.current) {
        window.clearInterval(listenIntervalRef.current)
        listenIntervalRef.current = null
      }
    }
  }, [
    currentSongId,
    isPlaying,
    playbackContextPlaylist.type,
    playbackContextPlaylist.id,
    playlistKey,
  ])

  const handleSort = (key: SortKey) => {
    if (!isSortablePlaylist) {
      return
    }

    const defaultDirection: Record<SortKey, "asc" | "desc"> = {
      title: "asc",
      artist: "asc",
      album: "asc",
      duration: "desc",
      time: "desc",
      lastPlayed: "desc",
      dateAdded: "desc",
    }

    setTableSortState((previous) => {
      const current =
        previous && previous.playlistKey === playlistKey ? previous : null
      if (!current || current.key !== key) {
        return { key, direction: defaultDirection[key], playlistKey }
      }
      return {
        key,
        direction: current.direction === "asc" ? "desc" : "asc",
        playlistKey,
      }
    })
  }

  const activeSortedSongs = useMemo(() => {
    if (!isSortablePlaylist || !tableSort) {
      return activeOrderedSongs
    }
    return applyTableSort(activeOrderedSongs, tableSort, activePlaylist, listeningDeltas)
  }, [
    activeOrderedSongs,
    isSortablePlaylist,
    tableSort,
    activePlaylist,
    listeningDeltas,
  ])

  const visibleSongs = useMemo(() => {
    if (!normalizedSearch) {
      return activeSortedSongs
    }

    const matches = (value?: string | null) =>
      Boolean(value && value.toLowerCase().includes(normalizedSearch))

    return activeSortedSongs.filter((song) => {
      const title = getSongTitle(song)
      return (
        matches(title) ||
        matches(song.artist ?? null) ||
        matches(song.album ?? null)
      )
    })
  }, [activeSortedSongs, normalizedSearch])

  const timeListenedLabel =
    activePlaylist.type === "smart" && activePlaylist.days
      ? `Time listened (${activePlaylist.days}d)`
      : "Time listened"

  const columns = useMemo<ColumnDef<PlaylistSong>[]>(() => {
    return [
      {
        id: "title",
        header: "Title",
        meta: {
          sortKey: "title",
          headerClassName: "w-[360px]",
          cellClassName: "font-medium truncate",
        } satisfies SongsColumnMeta,
        cell: ({ row }) => getSongTitle(row.original),
      },
      {
        id: "artist",
        header: "Artist",
        meta: {
          sortKey: "artist",
          headerClassName: "w-[160px]",
          cellClassName: "truncate",
        } satisfies SongsColumnMeta,
        cell: ({ row }) => row.original.artist ?? "--",
      },
      {
        id: "album",
        header: "Album",
        meta: {
          sortKey: "album",
          headerClassName: "w-[160px]",
          cellClassName: "truncate",
        } satisfies SongsColumnMeta,
        cell: ({ row }) => row.original.album ?? "--",
      },
      {
        id: "duration",
        header: "Duration",
        meta: {
          sortKey: "duration",
          headerClassName: "w-[90px]",
        } satisfies SongsColumnMeta,
        cell: ({ row }) => formatDuration(row.original.duration),
      },
      {
        id: "time",
        header: timeListenedLabel,
        meta: {
          sortKey: "time",
          headerClassName: "w-[120px]",
        } satisfies SongsColumnMeta,
        cell: ({ row }) =>
          formatListeningTime(
            getDisplayListeningSeconds(
              row.original,
              activePlaylist,
              listeningDeltas,
            ),
          ),
      },
      {
        id: "lastPlayed",
        header: "Last played",
        meta: {
          sortKey: "lastPlayed",
          headerClassName: "w-[120px]",
        } satisfies SongsColumnMeta,
        cell: ({ row }) =>
          formatDate(
            "last_played" in row.original
              ? (row.original.last_played as string | null)
              : null,
          ),
      },
      {
        id: "dateAdded",
        header: "Date added",
        meta: {
          sortKey: "dateAdded",
          headerClassName: "w-[120px]",
        } satisfies SongsColumnMeta,
        cell: ({ row }) => formatDate(row.original.uploaded_at),
      },
      {
        id: "actions",
        header: "",
        meta: {
          headerClassName: "w-12 text-right",
          cellClassName: "text-right",
        } satisfies SongsColumnMeta,
        cell: ({ row }) => (
          <Popover
            open={openMenuSongId === row.original.id}
            onOpenChange={(open) =>
              setOpenMenuSongId(open ? row.original.id : null)
            }
          >
            <PopoverTrigger asChild>
              <div onClick={(event) => event.stopPropagation()}>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-haspopup="menu"
                  aria-expanded={openMenuSongId === row.original.id}
                  aria-label="Song actions"
                >
                  <MoreVertical />
                </Button>
              </div>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              sideOffset={8}
              className="min-w-[11rem] p-1"
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
                    <Button
                      key={playlist.id}
                      type="button"
                      variant="ghost"
                      size="sm"
                      role="menuitem"
                      className="w-full justify-start rounded-sm px-2 py-1.5 text-left text-xs hover:bg-accent hover:text-accent-foreground"
                      onClick={(event) => {
                        event.stopPropagation()
                        addToPlaylistMutation.mutate({
                          playlistId: playlist.id,
                          trackId: row.original.id,
                        })
                        closeMenu()
                      }}
                    >
                      Add to {playlist.name}
                    </Button>
                  ))
                )}
              </div>
            </PopoverContent>
          </Popover>
        ),
      },
    ]
  }, [
    activePlaylist,
    timeListenedLabel,
    listeningDeltas,
    openMenuSongId,
    playlistsLoading,
    playlistsError,
    playlists,
    addToPlaylistMutation,
    closeMenu,
  ])

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: visibleSongs,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => String(row.id),
  })

  const rows = table.getRowModel().rows
  const getRowKey = useCallback(
    (index: number) => rows[index]?.id ?? index,
    [rows],
  )
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 30,
    overscan: 10,
    getItemKey: getRowKey,
  })
  const virtualRows = rowVirtualizer.getVirtualItems()
  const paddingTop = virtualRows.length > 0 ? virtualRows[0].start : 0
  const paddingBottom =
    virtualRows.length > 0
      ? rowVirtualizer.getTotalSize() -
        virtualRows[virtualRows.length - 1].end
      : 0

  const playbackQueueSongs = useMemo(() => {
    if (
      playbackPlaylistKey === playlistKey &&
      isSortablePlaylist &&
      tableSort
    ) {
      return applyTableSort(playbackOrderedSongs, tableSort, activePlaylist, listeningDeltas)
    }
    return playbackOrderedSongs
  }, [
    playbackOrderedSongs,
    playbackPlaylistKey,
    playlistKey,
    isSortablePlaylist,
    tableSort,
    activePlaylist,
    listeningDeltas,
  ])

  useEffect(() => {
    if (!playbackQueueSongs.length) {
      audioRef.current?.pause()
      return
    }

    const { queue, index } = buildQueue(
      playbackQueueSongs,
      shuffle,
      currentSongIdRef.current,
    )
    setPlayQueue(queue)
    setQueueIndex(index)

    if (currentSongIdRef.current && !queue.includes(currentSongIdRef.current)) {
      // Only explicit song selection should switch playback.
      shouldAutoPlayRef.current = false
    }
  }, [playbackQueueSongs, shuffle])

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
    const { queue, index } = buildQueue(activeSortedSongs, shuffle, song.id)
    setPlayQueue(queue)
    setQueueIndex(index)

    shouldAutoPlayRef.current = true
    setCurrentSongId(song.id)
  }

  const handleTogglePlay = () => {
    const audio = audioRef.current
    if (!audio) {
      return
    }

    if (!currentSongId) {
      if (!activeSortedSongs.length) {
        return
      }

      const firstSong = activeSortedSongs[0]
      if (!firstSong) {
        return
      }

      setPlaybackPlaylist(activePlaylist)
      const { queue, index } = buildQueue(
        activeSortedSongs,
        shuffle,
        firstSong.id,
      )
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
    <div className="flex h-svh flex-1 flex-col overflow-hidden">
      <div className="flex min-h-0 flex-1 flex-col gap-6 p-6">
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
                  ? `${visibleSongs.length} of ${songs.length} songs`
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
        ) : visibleSongs.length === 0 ? (
          <div className="text-muted-foreground rounded-lg border p-6">
            No songs match "{searchQuery.trim()}".
          </div>
        ) : (
          <div className="rounded-lg border [overflow-anchor:none] flex min-h-0 flex-1 flex-col">
            <div
              ref={tableContainerRef}
              className="relative flex-1 overflow-auto"
            >
              <Table className="table-fixed" containerClassName="overflow-visible">
                <TableHeader className="sticky top-0 z-10 bg-card">
                  {table.getHeaderGroups().map((headerGroup) => (
                    <TableRow key={headerGroup.id} className="bg-card">
                      {headerGroup.headers.map((header) => {
                        const meta = header.column.columnDef.meta as
                          | SongsColumnMeta
                          | undefined
                        const sortKey = meta?.sortKey
                        const isActive = sortKey
                          ? tableSort?.key === sortKey
                          : false
                        const direction = isActive
                          ? tableSort?.direction
                          : null
                        const ariaSort = sortKey
                          ? isActive
                            ? direction === "asc"
                              ? "ascending"
                              : "descending"
                            : "none"
                          : undefined
                        const headerLabel = header.isPlaceholder
                          ? null
                          : flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )

                        return (
                          <TableHead
                            key={header.id}
                            className={meta?.headerClassName}
                            aria-sort={ariaSort}
                          >
                            {sortKey && isSortablePlaylist ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="text-foreground h-auto px-0 py-0 text-left font-medium hover:bg-transparent"
                                onClick={() => handleSort(sortKey)}
                              >
                                <span>{headerLabel}</span>
                                {isActive ? (
                                  direction === "asc" ? (
                                    <ArrowUp className="size-3 text-muted-foreground" />
                                  ) : (
                                    <ArrowDown className="size-3 text-muted-foreground" />
                                  )
                                ) : (
                                  <ArrowUpDown className="size-3 text-muted-foreground/60" />
                                )}
                              </Button>
                            ) : (
                              headerLabel
                            )}
                          </TableHead>
                        )
                      })}
                    </TableRow>
                  ))}
                </TableHeader>
                <TableBody className="relative">
                  {paddingTop > 0 ? (
                    <TableRow className="border-0 hover:bg-transparent">
                      <TableCell
                        colSpan={columns.length}
                        className="p-0"
                        style={{ height: `${paddingTop}px` }}
                      />
                    </TableRow>
                  ) : null}
                  {virtualRows.map((virtualRow) => {
                    const row = rows[virtualRow.index]
                    if (!row) {
                      return null
                    }
                    return (
                      <TableRow
                        key={row.id}
                        data-index={virtualRow.index}
                        ref={rowVirtualizer.measureElement}
                        data-state={
                          currentSongId === row.original.id
                            ? "selected"
                            : undefined
                        }
                        className="cursor-pointer select-none focus-visible:outline-none"
                        onClick={() => handleSelectSong(row.original)}
                      >
                        {row.getVisibleCells().map((cell) => {
                          const meta = cell.column.columnDef.meta as
                            | SongsColumnMeta
                            | undefined
                          return (
                            <TableCell
                              key={cell.id}
                              className={meta?.cellClassName}
                            >
                              {flexRender(
                                cell.column.columnDef.cell,
                                cell.getContext(),
                              )}
                            </TableCell>
                          )
                        })}
                      </TableRow>
                    )
                  })}
                  {paddingBottom > 0 ? (
                    <TableRow className="border-0 hover:bg-transparent">
                      <TableCell
                        colSpan={columns.length}
                        className="p-0"
                        style={{ height: `${paddingBottom}px` }}
                      />
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </div>
      <div className="mt-auto px-6 pb-6">
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
                <Slider
                  min={0.5}
                  max={1.5}
                  step={0.01}
                  value={playbackRateValue}
                  onValueChange={(value) => {
                    const next = value[0]
                    if (typeof next !== "number") {
                      return
                    }
                    const clamped = clamp(next, 0.5, 1.5)
                    if (clamped !== playbackRate) {
                      setPlaybackRate(clamped)
                    }
                  }}
                  className="w-24"
                  aria-label="Playback speed"
                />
                <span className="w-8 text-right">
                  {Math.round(playbackRate * 100)}%
                </span>
              </label>
              <label className="flex items-center gap-2 text-[10px] text-muted-foreground">
                <Volume2 className="size-4" />
                <Slider
                  min={0}
                  max={1}
                  step={0.01}
                  value={volumeValue}
                  onValueChange={(value) => {
                    const next = value[0]
                    if (typeof next !== "number") {
                      return
                    }
                    const clamped = clamp(next, 0, 1)
                    if (clamped !== volume) {
                      setVolume(clamped)
                    }
                  }}
                  className="w-24"
                  aria-label="Volume"
                />
                <span className="w-8 text-right">
                  {Math.round(volume * 100)}%
                </span>
              </label>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="w-10 text-right">{formatTime(displayCurrentTime)}</span>
            <Slider
              min={0}
              max={displayDuration || 0}
              step={0.25}
              value={seekValue}
              onPointerDown={() => setIsSeeking(true)}
              onPointerUp={() => setIsSeeking(false)}
              onPointerCancel={() => setIsSeeking(false)}
              onValueChange={(value) => {
                const next = value[0]
                if (typeof next !== "number") {
                  return
                }
                if (!isSeeking) {
                  return
                }
                if (next !== currentTime) {
                  handleSeek(next)
                }
              }}
              onValueCommit={(value) => {
                const next = value[0]
                if (typeof next !== "number") {
                  return
                }
                handleSeek(next)
              }}
              className="w-full"
              disabled={!currentSongId || !displayDuration}
              aria-label="Seek"
            />
            <span className="w-10">{formatTime(displayDuration)}</span>
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
