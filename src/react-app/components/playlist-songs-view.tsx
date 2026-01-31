import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  MoreVertical,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
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
} from "@/react-app/lib/api"
import {
  getPlaylistKey,
  usePlaybackStore,
  type ActivePlaylist,
} from "@/react-app/lib/playback-store"
import { fetchSongsForPlaylist } from "@/react-app/lib/songs"
import { useListenTracker } from "@/react-app/hooks/use-listen-tracker"
import type {
  PlaylistSong,
} from "@/react-app/lib/types"

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
const EMPTY_LISTENING_DELTAS: Record<number, number> = {}

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

type PlaylistSongsViewProps = {
  playlist: ActivePlaylist
}

export function PlaylistSongsView({ playlist }: PlaylistSongsViewProps) {
  const queryClient = useQueryClient()
  const currentSongId = usePlaybackStore((state) => state.currentSongId)
  const startPlayback = usePlaybackStore((state) => state.startPlayback)
  const restartCurrentSong = usePlaybackStore(
    (state) => state.restartCurrentSong,
  )
  const setActivePlaylistSongIds = usePlaybackStore(
    (state) => state.setActivePlaylistSongIds,
  )
  const activePlaylist = playlist
  const playlistKey = getPlaylistKey(activePlaylist)
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
  const [scrollElement, setScrollElement] = useState<HTMLDivElement | null>(null)
  const setTableContainerRef = useCallback((element: HTMLDivElement | null) => {
    setScrollElement(element)
  }, [])
  const listeningDeltas = useMemo(
    () =>
      listeningState.playlistKey === playlistKey
        ? listeningState.deltas
        : {},
    [listeningState, playlistKey],
  )
  const listeningDeltasRef = useRef(listeningDeltas)
  const tableSort =
    tableSortState?.playlistKey === playlistKey ? tableSortState : null
  const handleListenDelta = useCallback(
    (trackId: number) => {
      setListeningState((previous) => {
        if (previous.playlistKey !== playlistKey) {
          return {
            playlistKey,
            deltas: { [trackId]: 1 },
          }
        }
        return {
          playlistKey,
          deltas: {
            ...previous.deltas,
            [trackId]: (previous.deltas[trackId] ?? 0) + 1,
          },
        }
      })
    },
    [playlistKey],
  )
  useListenTracker({ onListenDelta: handleListenDelta })

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
      queryClient.invalidateQueries({ queryKey: ["playlists"] })
    },
  })

  const isSortablePlaylist =
    activePlaylist.type === "custom" ||
    (activePlaylist.type === "smart" && activePlaylist.id === "all")
  const normalizedSearch = searchQuery.trim().toLowerCase()
  const hasSearch = normalizedSearch.length > 0
  const shouldOrderByListening =
    activePlaylist.type === "smart" && activePlaylist.sort === "popular"
  // Keep table order stable while listening time ticks up client-side.
  const listeningDeltasForOrder = EMPTY_LISTENING_DELTAS
  const listeningDeltasForSort = EMPTY_LISTENING_DELTAS

  const activeOrderedSongs = useMemo(() => {
    if (shouldOrderByListening) {
      return orderSongsByListening(
        songs,
        activePlaylist,
        listeningDeltasForOrder,
      )
    }
    return songs
  }, [songs, activePlaylist, shouldOrderByListening, listeningDeltasForOrder])

  useEffect(() => {
    listeningDeltasRef.current = listeningDeltas
  }, [listeningDeltas])

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
    return applyTableSort(
      activeOrderedSongs,
      tableSort,
      activePlaylist,
      listeningDeltasForSort,
    )
  }, [
    activeOrderedSongs,
    isSortablePlaylist,
    tableSort,
    activePlaylist,
    listeningDeltasForSort,
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
              listeningDeltasRef.current,
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
    getScrollElement: () => scrollElement,
    estimateSize: () => 30,
    overscan: 10,
    getItemKey: getRowKey,
    enabled: Boolean(scrollElement),
  })
  const virtualRows = scrollElement ? rowVirtualizer.getVirtualItems() : []
  const paddingTop = virtualRows.length > 0 ? virtualRows[0].start : 0
  const paddingBottom =
    virtualRows.length > 0
      ? rowVirtualizer.getTotalSize() -
        virtualRows[virtualRows.length - 1].end
      : 0
  const activeSortedIds = useMemo(
    () => activeSortedSongs.map((song) => song.id),
    [activeSortedSongs],
  )

  useEffect(() => {
    setActivePlaylistSongIds(activeSortedIds)
  }, [activeSortedIds, setActivePlaylistSongIds])

  const handleSelectSong = useCallback(
    (song: PlaylistSong) => {
      if (currentSongId === song.id) {
        restartCurrentSong()
        return
      }

      startPlayback({
        playlist: activePlaylist,
        songIds: activeSortedIds,
        songId: song.id,
      })
    },
    [
      activePlaylist,
      activeSortedIds,
      currentSongId,
      restartCurrentSong,
      startPlayback,
    ],
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
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
              ref={setTableContainerRef}
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
                        data-state={
                          currentSongId === row.original.id
                            ? "selected"
                            : undefined
                        }
                        className="h-8 cursor-pointer select-none focus-visible:outline-none"
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
    </div>
  )
}
