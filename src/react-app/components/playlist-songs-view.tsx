import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useState } from "react"
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
  type Row,
  useReactTable,
} from "@tanstack/react-table"
import { useVirtualizer } from "@tanstack/react-virtual"
import {
  addTrackToPlaylist,
  deleteSong,
  removeTrackFromPlaylist,
} from "@/react-app/lib/api"
import {
  getPlaylistKey,
  usePlaybackStore,
  type ActivePlaylist,
} from "@/react-app/lib/playback-store"
import { fetchSongsForPlaylist } from "@/react-app/lib/songs"
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

const getSongTitle = (song: PlaylistSong) => {
  const title = song.title?.trim()
  return title ? title : song.filename
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
  playlists: { id: number; name: string }[]
  playlistsLoading: boolean
  playlistsError: boolean
}

type SongRowProps = {
  row: Row<PlaylistSong>
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
      className="h-8 cursor-pointer select-none focus-visible:outline-none"
      onClick={() => onSelect(row.original)}
    >
      {row.getVisibleCells().map((cell) => {
        const meta = cell.column.columnDef.meta as SongsColumnMeta | undefined
        return (
          <TableCell key={cell.id} className={meta?.cellClassName}>
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
  playlists: { id: number; name: string }[]
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
  const queryClient = useQueryClient()
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
  const [tableSortState, setTableSortState] = useState<
    (TableSort & { playlistKey: string }) | null
  >(null)
  const [scrollElement, setScrollElement] = useState<HTMLDivElement | null>(null)
  const setTableContainerRef = useCallback((element: HTMLDivElement | null) => {
    setScrollElement(element)
  }, [])
  const tableSort =
    tableSortState?.playlistKey === playlistKey ? tableSortState : null

  const {
    data: songs = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["songs", playlistKey],
    queryFn: () => fetchSongsForPlaylist(activePlaylist),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  })
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
  const removeFromPlaylistMutation = useMutation({
    mutationFn: ({
      playlistId,
      trackId,
    }: {
      playlistId: number
      trackId: number
    }) => removeTrackFromPlaylist(playlistId, trackId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["songs"] })
      queryClient.invalidateQueries({ queryKey: ["playlists"] })
    },
  })
  const deleteSongMutation = useMutation({
    mutationFn: (trackId: number) => deleteSong(trackId),
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
      return songs
    }
    return applyTableSort(
      songs,
      tableSort,
      activePlaylist,
    )
  }, [
    songs,
    isSortablePlaylist,
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
