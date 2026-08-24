import { useCallback, useEffect, useMemo, useState } from "react"
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  MoreVertical,
  Search,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
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
  metaHelper,
  tableFeatures,
  type ColumnDef,
  type Row,
  useTable,
} from "@tanstack/react-table"
import { useVirtualizer } from "@tanstack/react-virtual"
import {
  getPlaylistKey,
  getPlaylistStatusMessage,
  type ActivePlaylist,
} from "@/react-app/lib/playlists"
import {
  useAddTrackToPlaylistMutation,
  useDeleteSongMutation,
  useRemoveTrackFromPlaylistMutation,
  useSongsQuery,
} from "@/react-app/lib/queries"
import { usePlaybackStore } from "@/react-app/lib/playback-store"
import { getSongTitle } from "@/react-app/lib/songs"
import type {
  PlaylistSummary,
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

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "2-digit",
})

const formatDate = (value?: string | null) => {
  if (!value) {
    return "--"
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return "--"
  }

  return dateFormatter.format(date)
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

const TABLE_SORT_STORAGE_KEY = "playlist.sortOrder"
const DEFAULT_SORT_DIRECTIONS: Record<SortKey, TableSort["direction"]> = {
  title: "asc",
  artist: "asc",
  album: "asc",
  duration: "desc",
  time: "desc",
  lastPlayed: "desc",
  dateAdded: "desc",
}
const SORT_KEYS = new Set<SortKey>(Object.keys(DEFAULT_SORT_DIRECTIONS) as SortKey[])

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const readStoredTableSorts = (): Record<string, TableSort> => {
  if (typeof window === "undefined") {
    return {}
  }

  try {
    const storedValue = window.localStorage.getItem(TABLE_SORT_STORAGE_KEY)
    if (!storedValue) {
      return {}
    }

    const storedSorts: unknown = JSON.parse(storedValue)
    if (!isRecord(storedSorts)) {
      return {}
    }

    const sorts: Record<string, TableSort> = {}
    for (const [playlistKey, storedSort] of Object.entries(storedSorts)) {
      if (!isRecord(storedSort)) {
        continue
      }

      const { key, direction } = storedSort
      if (
        typeof key === "string" &&
        SORT_KEYS.has(key as SortKey) &&
        (direction === "asc" || direction === "desc")
      ) {
        sorts[playlistKey] = {
          key: key as SortKey,
          direction,
        }
      }
    }

    return sorts
  } catch {
    return {}
  }
}

const storeTableSorts = (sorts: Record<string, TableSort>) => {
  try {
    window.localStorage.setItem(TABLE_SORT_STORAGE_KEY, JSON.stringify(sorts))
  } catch {
    // Ignore storage failures (for example, private browsing restrictions).
  }
}

type SongsColumnMeta = {
  sortKey?: SortKey
  headerClassName?: string
  cellClassName?: string
}

const playlistTableFeatures = tableFeatures({
  columnMeta: metaHelper<SongsColumnMeta>(),
})

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

const applyTableSort = (
  items: PlaylistSong[],
  sort: TableSort,
  playlist: ActivePlaylist,
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
        return getListeningSecondsForPlaylist(song, playlist)
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
  playlists: PlaylistSummary[]
  playlistsLoading: boolean
  playlistsError: boolean
}

type SongRowProps = {
  row: Row<typeof playlistTableFeatures, PlaylistSong>
  onSelect: (song: PlaylistSong) => void
}

function SongRow({ row, onSelect }: SongRowProps) {
  const isSelected = usePlaybackStore(
    useCallback(
      (state) => state.currentSongId === row.original.id,
      [row.original.id],
    ),
  )

  return (
    <TableRow
      data-state={isSelected ? "selected" : undefined}
      className="h-6 cursor-pointer select-none focus-visible:outline-none"
      onClick={() => onSelect(row.original)}
    >
      {row.getAllCells().map((cell, cellIndex) => {
        const meta = cell.column.columnDef.meta
        return (
          <TableCell
            key={cell.id}
            className={cn(meta?.cellClassName, cellIndex === 0 && "pl-0")}
          >
            {flexRender(cell.column.columnDef.cell, cell.getContext())}
          </TableCell>
        )
      })}
    </TableRow>
  )
}

type SongActionsMenuProps = {
  trackId: number
  activePlaylist: ActivePlaylist
  playlists: PlaylistSummary[]
  playlistsLoading: boolean
  playlistsError: boolean
  onAddToPlaylist: (playlistId: number, trackId: number) => void
  onRemoveFromPlaylist: (playlistId: number, trackId: number) => void
  onDeleteSong: (trackId: number) => void
}

function SongActionsMenu({
  trackId,
  activePlaylist,
  playlists,
  playlistsLoading,
  playlistsError,
  onAddToPlaylist,
  onRemoveFromPlaylist,
  onDeleteSong,
}: SongActionsMenuProps) {
  const [open, setOpen] = useState(false)
  const isCustomPlaylist = activePlaylist.type === "custom"
  const handleAdd = useCallback(
    (playlistId: number) => {
      onAddToPlaylist(playlistId, trackId)
      setOpen(false)
    },
    [onAddToPlaylist, trackId],
  )
  const handleRemove = useCallback(() => {
    if (activePlaylist.type !== "custom") {
      return
    }
    onRemoveFromPlaylist(activePlaylist.id, trackId)
    setOpen(false)
  }, [activePlaylist, onRemoveFromPlaylist, trackId])
  const handleDelete = useCallback(() => {
    const confirmed = window.confirm(
      "Delete this song? This removes it from all playlists.",
    )
    if (!confirmed) {
      return
    }
    onDeleteSong(trackId)
    setOpen(false)
  }, [onDeleteSong, trackId])
  const playlistStatusMessage = getPlaylistStatusMessage({
    playlists,
    isLoading: playlistsLoading,
    isError: playlistsError,
  })

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div onClick={(event) => event.stopPropagation()}>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-haspopup="menu"
            aria-expanded={open}
            aria-label="Song actions"
          >
            <MoreVertical />
          </Button>
        </div>
      </PopoverTrigger>
      {open ? (
        <PopoverContent
          align="end"
          sideOffset={8}
          className="min-w-[11rem] p-1"
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <div className="flex flex-col">
            {playlistStatusMessage ? (
              <div className="text-muted-foreground px-2 py-1.5 text-xs">
                {playlistStatusMessage}
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
                    handleAdd(playlist.id)
                  }}
                >
                  Add to {playlist.name}
                </Button>
              ))
            )}
            <div className="my-1 h-px bg-border" role="separator" />
            {isCustomPlaylist ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                role="menuitem"
                className="w-full justify-start rounded-sm px-2 py-1.5 text-left text-xs hover:bg-accent hover:text-accent-foreground"
                onClick={(event) => {
                  event.stopPropagation()
                  handleRemove()
                }}
              >
                Remove from {activePlaylist.name}
              </Button>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              role="menuitem"
              className="text-destructive hover:text-destructive w-full justify-start rounded-sm px-2 py-1.5 text-left text-xs hover:bg-destructive/10"
              onClick={(event) => {
                event.stopPropagation()
                handleDelete()
              }}
            >
              Delete song
            </Button>
          </div>
        </PopoverContent>
      ) : null}
    </Popover>
  )
}

export function PlaylistSongsView({
  playlist,
  playlists,
  playlistsLoading,
  playlistsError,
}: PlaylistSongsViewProps) {
  const startPlayback = usePlaybackStore((state) => state.startPlayback)
  const restartCurrentSong = usePlaybackStore(
    (state) => state.restartCurrentSong,
  )
  const setActivePlaylistSongIds = usePlaybackStore(
    (state) => state.setActivePlaylistSongIds,
  )
  const activePlaylist = playlist
  const playlistKey = getPlaylistKey(activePlaylist)
  const [searchQuery, setSearchQuery] = useState("")
  const [tableSorts, setTableSorts] = useState<Record<string, TableSort>>(
    readStoredTableSorts,
  )
  const [scrollElement, setScrollElement] = useState<HTMLDivElement | null>(null)
  const setTableContainerRef = useCallback((element: HTMLDivElement | null) => {
    setScrollElement(element)
  }, [])
  const tableSort = tableSorts[playlistKey] ?? null

  useEffect(() => {
    storeTableSorts(tableSorts)
  }, [tableSorts])

  const {
    data: songs = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useSongsQuery(activePlaylist)
  const addToPlaylistMutation = useAddTrackToPlaylistMutation()
  const removeFromPlaylistMutation = useRemoveTrackFromPlaylistMutation()
  const deleteSongMutation = useDeleteSongMutation()

  const normalizedSearch = searchQuery.trim().toLowerCase()
  const hasSearch = normalizedSearch.length > 0
  const handleAddToPlaylist = useCallback(
    (playlistId: number, trackId: number) => {
      addToPlaylistMutation.mutate({ playlistId, trackId })
    },
    [addToPlaylistMutation],
  )
  const handleRemoveFromPlaylist = useCallback(
    (playlistId: number, trackId: number) => {
      removeFromPlaylistMutation.mutate({ playlistId, trackId })
    },
    [removeFromPlaylistMutation],
  )
  const handleDeleteSong = useCallback(
    (trackId: number) => {
      deleteSongMutation.mutate(trackId)
    },
    [deleteSongMutation],
  )

  const handleSort = (key: SortKey) => {
    const current = tableSorts[playlistKey]
    const nextSort: TableSort =
      !current || current.key !== key
        ? { key, direction: DEFAULT_SORT_DIRECTIONS[key] }
        : {
            key,
            direction: current.direction === "asc" ? "desc" : "asc",
        }

    setTableSorts((previous) => ({
      ...previous,
      [playlistKey]: nextSort,
    }))
  }

  const activeSortedSongs = useMemo(() => {
    if (!tableSort) {
      return songs
    }
    return applyTableSort(
      songs,
      tableSort,
      activePlaylist,
    )
  }, [
    songs,
    tableSort,
    activePlaylist,
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

  const columns = useMemo<
    ColumnDef<typeof playlistTableFeatures, PlaylistSong>[]
  >(() => {
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
            getListeningSecondsForPlaylist(row.original, activePlaylist),
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
        cell: ({ row }) => {
          return (
            <SongActionsMenu
              trackId={row.original.id}
              activePlaylist={activePlaylist}
              playlists={playlists}
              playlistsLoading={playlistsLoading}
              playlistsError={playlistsError}
              onAddToPlaylist={handleAddToPlaylist}
              onRemoveFromPlaylist={handleRemoveFromPlaylist}
              onDeleteSong={handleDeleteSong}
            />
          )
        },
      },
    ]
  }, [
    activePlaylist,
    timeListenedLabel,
    playlistsLoading,
    playlistsError,
    playlists,
    handleAddToPlaylist,
    handleRemoveFromPlaylist,
    handleDeleteSong,
  ])

  const table = useTable({
    features: playlistTableFeatures,
    data: visibleSongs,
    columns,
    getRowId: (row) => String(row.id),
  })

  const rows = table.getRowModel().rows
  const getRowKey = useCallback(
    (index: number) => rows[index]?.id ?? index,
    [rows],
  )
  // eslint-disable-next-line react-hooks/incompatible-library
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollElement,
    estimateSize: () => 24,
    overscan: 30,
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
      const { currentSongId } = usePlaybackStore.getState()
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
    [activePlaylist, activeSortedIds, restartCurrentSong, startPlayback],
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex min-h-0 flex-1 flex-col gap-3 px-3 pt-3">
        <div className="flex items-center justify-between gap-4">
          <h1 className="min-w-0 flex-1 truncate text-lg font-semibold">
            {activePlaylist.name}
          </h1>
          <div className="flex min-w-0 shrink-0 items-center justify-end gap-3">
            <div className="shrink-0 text-xs text-muted-foreground">
              {isLoading
                ? "Loading songs..."
                : hasSearch
                  ? `${visibleSongs.length} of ${songs.length} songs`
                  : `${songs.length} songs`}
            </div>
            <div className="relative w-80 max-w-[45vw]">
              <Search className="text-muted-foreground pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2" />
              <Input
                type="search"
                placeholder="Search playlist"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="w-full pl-8"
                aria-label="Search playlist"
              />
            </div>
          </div>
        </div>
        {isLoading ? (
          <div className="text-muted-foreground rounded-sm border p-4 text-xs">
            Loading your songs...
          </div>
        ) : isError ? (
          <div className="border-destructive/40 bg-destructive/5 rounded-sm border p-4">
            <p className="text-destructive text-sm">
              {error instanceof Error ? error.message : "Failed to load songs."}
            </p>
            <Button className="mt-4" variant="outline" onClick={() => refetch()}>
              Try again
            </Button>
          </div>
        ) : songs.length === 0 ? (
          <div className="text-muted-foreground rounded-sm border p-4 text-xs">
            {activePlaylist.type === "custom"
              ? "This playlist is empty. Add songs to get started."
              : activePlaylist.type === "smart" && activePlaylist.days
                ? `No songs played in the last ${activePlaylist.days} days.`
                : "No songs yet. Upload a track to get started."}
          </div>
        ) : visibleSongs.length === 0 ? (
          <div className="text-muted-foreground rounded-sm border p-4 text-xs">
            No songs match "{searchQuery.trim()}".
          </div>
        ) : (
          <div className="[overflow-anchor:none] flex min-h-0 flex-1 flex-col bg-background/65">
            <div
              ref={setTableContainerRef}
              className="relative flex-1 overflow-auto"
            >
              <Table className="table-fixed" containerClassName="overflow-visible">
                <TableHeader className="sticky top-0 z-10 bg-background/95">
                  {table.getHeaderGroups().map((headerGroup) => (
                    <TableRow key={headerGroup.id} className="bg-background/95 hover:bg-background/95">
                      {headerGroup.headers.map((header, headerIndex) => {
                        const meta = header.column.columnDef.meta
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
                            className={`p-0 text-[13px] ${meta?.headerClassName ?? ""}`}
                            aria-sort={ariaSort}
                          >
                            {sortKey ? (
                              <button
                                type="button"
                                className={cn(
                                  "flex h-7 w-full items-center justify-start gap-1 px-2 py-0 text-left text-[14px] font-medium text-foreground outline-none hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                                  headerIndex === 0 && "pl-0",
                                )}
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
                              </button>
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
                      <SongRow
                        key={row.id}
                        row={row}
                        onSelect={handleSelectSong}
                      />
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
