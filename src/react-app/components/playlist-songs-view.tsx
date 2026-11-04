import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, MoreVertical, Search } from "lucide-react";

import { SidebarTrigger } from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/use-mobile";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  flexRender,
  metaHelper,
  tableFeatures,
  type Cell,
  type ColumnDef,
  type Row,
  useTable,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  getPlaylistKey,
  getPlaylistStatusMessage,
  type ActivePlaylist,
} from "@/react-app/lib/playlists";
import {
  useAddTrackToPlaylistMutation,
  useDeleteSongMutation,
  usePlaylistsQuery,
  useRemoveTrackFromPlaylistMutation,
  useSongsQuery,
} from "@/react-app/lib/queries";
import { usePlaybackStore } from "@/react-app/lib/playback-store";
import { getSongTitle } from "@/react-app/lib/songs";
import { SongCover } from "@/react-app/components/song-cover";
import { jsonSetting, useLocalStorage } from "@/react-app/lib/local-storage";
import type { PlaylistSong } from "@/react-app/lib/types";

const formatDuration = (seconds?: number | null) => {
  if (!seconds || seconds <= 0) {
    return "";
  }

  const rounded = Math.round(seconds);
  const minutes = Math.floor(rounded / 60);
  const remaining = rounded % 60;
  return `${minutes}:${remaining.toString().padStart(2, "0")}`;
};

const formatListeningTime = (seconds?: number | null) => {
  if (!seconds || seconds <= 0) {
    return "";
  }

  const rounded = Math.round(seconds);
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  const remaining = rounded % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (minutes > 0) {
    return `${minutes}m ${remaining}s`;
  }

  return `${remaining}s`;
};

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "2-digit",
});

const formatDate = (value?: string | null) => {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return dateFormatter.format(date);
};

type SortKey = "title" | "artist" | "album" | "duration" | "time" | "lastPlayed" | "dateAdded";

type TableSort = {
  key: SortKey;
  direction: "asc" | "desc";
};

const DEFAULT_SORT_DIRECTIONS: Record<SortKey, TableSort["direction"]> = {
  title: "asc",
  artist: "asc",
  album: "asc",
  duration: "desc",
  time: "desc",
  lastPlayed: "desc",
  dateAdded: "desc",
};
const SORT_KEYS = new Set<SortKey>(Object.keys(DEFAULT_SORT_DIRECTIONS) as SortKey[]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const tableSortsSetting = jsonSetting<Record<string, TableSort>>(
  "playlist.sortOrder",
  {},
  (stored) => {
    if (!isRecord(stored)) return undefined;
    const sorts: Record<string, TableSort> = {};
    for (const [playlistKey, storedSort] of Object.entries(stored)) {
      if (!isRecord(storedSort)) continue;
      const { key, direction } = storedSort;
      if (
        typeof key === "string" &&
        SORT_KEYS.has(key as SortKey) &&
        (direction === "asc" || direction === "desc")
      ) {
        sorts[playlistKey] = { key: key as SortKey, direction };
      }
    }
    return sorts;
  },
);

type SongsColumnMeta = {
  sortKey?: SortKey;
  /** Left out on phones, where only the title, time listened and actions fit. */
  hideOnMobile?: boolean;
  /** Right-aligned, for durations and times. */
  numeric?: boolean;
  headerClassName?: string;
  cellClassName?: string;
};

const playlistTableFeatures = tableFeatures({
  columnMeta: metaHelper<SongsColumnMeta>(),
});

const getListeningSecondsForPlaylist = (song: PlaylistSong, playlist: ActivePlaylist) => {
  if (playlist.type === "smart" && playlist.days) {
    return "window_seconds" in song ? (song.window_seconds as number | null) : null;
  }

  return "seconds_listened" in song ? (song.seconds_listened as number | null) : null;
};

const applyTableSort = (items: PlaylistSong[], sort: TableSort, playlist: ActivePlaylist) => {
  const toDateValue = (value?: string | null) => {
    if (!value) {
      return null;
    }
    const time = new Date(value).getTime();
    return Number.isNaN(time) ? null : time;
  };

  const getSortValue = (song: PlaylistSong) => {
    switch (sort.key) {
      case "title":
        return getSongTitle(song);
      case "artist":
        return song.artist ?? null;
      case "album":
        return song.album ?? null;
      case "duration":
        return song.duration ?? null;
      case "time":
        return getListeningSecondsForPlaylist(song, playlist);
      case "lastPlayed":
        return "last_played" in song ? toDateValue(song.last_played as string | null) : null;
      case "dateAdded":
        return toDateValue(song.uploaded_at);
      default:
        return null;
    }
  };

  const compareValues = (first: string | number | null, second: string | number | null) => {
    if (first === null && second === null) {
      return 0;
    }
    if (first === null) {
      return 1;
    }
    if (second === null) {
      return -1;
    }
    if (typeof first === "string" || typeof second === "string") {
      return String(first).localeCompare(String(second), undefined, {
        sensitivity: "base",
      });
    }
    return first - second;
  };

  const direction = sort.direction === "asc" ? 1 : -1;

  return [...items].sort((first, second) => {
    const result = compareValues(getSortValue(first), getSortValue(second));
    if (result !== 0) {
      return result * direction;
    }
    return getSongTitle(first).localeCompare(getSongTitle(second));
  });
};

type SongRowProps = {
  song: PlaylistSong;
  /**
   * Passed in rather than read from the row: a row outlives column changes, so reading
   * `row.getAllCells()` here would let React Compiler keep showing the old columns.
   */
  cells: Cell<typeof playlistTableFeatures, PlaylistSong>[];
  index: number;
  /** Lets the virtualizer measure the real height, which grows with the font size. */
  measureRef: (element: HTMLTableRowElement | null) => void;
  onSelect: (song: PlaylistSong) => void;
};

function SongRow({ song, cells, index, measureRef, onSelect }: SongRowProps) {
  const isSelected = usePlaybackStore((state) => state.currentSongId === song.id);

  return (
    <TableRow
      ref={measureRef}
      data-index={index}
      data-state={isSelected ? "selected" : undefined}
      className="group/row h-12 cursor-pointer select-none focus-visible:outline-none md:h-8"
      onClick={() => onSelect(song)}
    >
      {cells.map((cell, cellIndex) => {
        const meta = cell.column.columnDef.meta;
        return (
          <TableCell
            key={cell.id}
            className={cn("py-1", meta?.cellClassName, cellIndex === 0 && "pl-0")}
          >
            {flexRender(cell.column.columnDef.cell, cell.getContext())}
          </TableCell>
        );
      })}
    </TableRow>
  );
}

type SongActionsMenuProps = {
  trackId: number;
  activePlaylist: ActivePlaylist;
};

function SongActionsMenu({ trackId, activePlaylist }: SongActionsMenuProps) {
  const [open, setOpen] = useState(false);

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
            className="size-9 md:size-6"
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
          <SongActions
            trackId={trackId}
            activePlaylist={activePlaylist}
            onDone={() => setOpen(false)}
          />
        </PopoverContent>
      ) : null}
    </Popover>
  );
}

/** Only mounted while a menu is open, so rows don't each subscribe to playlists and mutations. */
function SongActions({
  trackId,
  activePlaylist,
  onDone,
}: SongActionsMenuProps & { onDone: () => void }) {
  const { data, isLoading, isError } = usePlaylistsQuery();
  const playlists = data?.playlists ?? [];
  const { mutate: addToPlaylist } = useAddTrackToPlaylistMutation();
  const { mutate: removeFromPlaylist } = useRemoveTrackFromPlaylistMutation();
  const { mutate: deleteSong } = useDeleteSongMutation();
  const playlistStatusMessage = getPlaylistStatusMessage({ playlists, isLoading, isError });

  return (
    <div className="flex flex-col">
      {playlistStatusMessage ? (
        <div className="text-muted-foreground px-2 py-1.5 text-xs">{playlistStatusMessage}</div>
      ) : (
        playlists.map((playlist) => (
          <Button
            key={playlist.id}
            type="button"
            variant="ghost"
            size="sm"
            role="menuitem"
            className="w-full justify-start rounded-sm px-2 py-1.5 text-left text-xs hover:bg-accent hover:text-accent-foreground"
            onClick={() => {
              addToPlaylist({ playlistId: playlist.id, trackId });
              onDone();
            }}
          >
            Add to {playlist.name}
          </Button>
        ))
      )}
      <div className="my-1 h-px bg-border" role="separator" />
      {activePlaylist.type === "custom" ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          role="menuitem"
          className="w-full justify-start rounded-sm px-2 py-1.5 text-left text-xs hover:bg-accent hover:text-accent-foreground"
          onClick={() => {
            removeFromPlaylist({ playlistId: activePlaylist.id, trackId });
            onDone();
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
        onClick={() => {
          if (!window.confirm("Delete this song? This removes it from all playlists.")) {
            return;
          }
          deleteSong(trackId);
          onDone();
        }}
      >
        Delete song
      </Button>
    </div>
  );
}

const SORT_LABELS: Record<SortKey, string> = {
  title: "Title",
  artist: "Artist",
  album: "Album",
  duration: "Duration",
  time: "Time listened",
  lastPlayed: "Last played",
  dateAdded: "Date added",
};

type MobileSortControlProps = {
  sort: TableSort | null;
  timeListenedLabel: string;
  onSort: (key: SortKey) => void;
};

/** Phones hide most columns, so their sort options live in a picker instead. */
function MobileSortControl({ sort, timeListenedLabel, onSort }: MobileSortControlProps) {
  const DirectionIcon = sort?.direction === "asc" ? ArrowUp : ArrowDown;

  return (
    <div className="flex shrink-0 items-center md:hidden">
      <select
        value={sort?.key ?? ""}
        onChange={(event) => onSort(event.target.value as SortKey)}
        className="h-9 appearance-none rounded-sm bg-transparent px-2 text-xs text-muted-foreground outline-none"
        aria-label="Sort by"
      >
        <option value="" disabled>
          Sort
        </option>
        {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
          <option key={key} value={key}>
            {key === "time" ? timeListenedLabel : SORT_LABELS[key]}
          </option>
        ))}
      </select>
      {sort ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => onSort(sort.key)}
          aria-label={sort.direction === "asc" ? "Sorted ascending" : "Sorted descending"}
          className="size-9 text-muted-foreground"
        >
          <DirectionIcon className="size-4" />
        </Button>
      ) : null}
    </div>
  );
}

type SongRowsProps = {
  rows: Row<typeof playlistTableFeatures, PlaylistSong>[];
  scrollElement: HTMLDivElement;
  columnCount: number;
  onSelect: (song: PlaylistSong) => void;
};

/** Renders only the rows on screen, with spacer rows standing in for the rest. */
function VirtualSongRows({ rows, scrollElement, columnCount, onSelect }: SongRowsProps) {
  // React Compiler can't safely memoize useVirtualizer, so it's kept to this small component.
  "use no memo";
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollElement,
    // h-8 row + 1px border at the default font size; rows are measured once rendered.
    estimateSize: () => 33,
    overscan: 30,
  });
  const virtualRows = rowVirtualizer.getVirtualItems();
  const paddingTop = virtualRows[0]?.start ?? 0;
  const paddingBottom = rowVirtualizer.getTotalSize() - (virtualRows.at(-1)?.end ?? 0);
  const spacer = (height: number) =>
    height > 0 ? (
      <TableRow className="border-0 hover:bg-transparent">
        <TableCell colSpan={columnCount} className="p-0" style={{ height }} />
      </TableRow>
    ) : null;

  return (
    <>
      {spacer(paddingTop)}
      {virtualRows.map((virtualRow) => {
        const row = rows[virtualRow.index];
        return row ? (
          <SongRow
            key={row.id}
            song={row.original}
            cells={row.getAllCells()}
            index={virtualRow.index}
            measureRef={rowVirtualizer.measureElement}
            onSelect={onSelect}
          />
        ) : null;
      })}
      {spacer(paddingBottom)}
    </>
  );
}

const NO_SONGS: PlaylistSong[] = [];

export function PlaylistSongsView({ playlist: activePlaylist }: { playlist: ActivePlaylist }) {
  const startPlayback = usePlaybackStore((state) => state.startPlayback);
  const restartCurrentSong = usePlaybackStore((state) => state.restartCurrentSong);
  const setActivePlaylistSongIds = usePlaybackStore((state) => state.setActivePlaylistSongIds);
  const playlistKey = getPlaylistKey(activePlaylist);
  const [searchQuery, setSearchQuery] = useState("");
  const [tableSorts, setTableSorts] = useLocalStorage(tableSortsSetting);
  const [scrollElement, setScrollElement] = useState<HTMLDivElement | null>(null);
  const tableSort = tableSorts[playlistKey] ?? null;

  const { data, isLoading, isError, error, refetch } = useSongsQuery(activePlaylist);
  const songs = data ?? NO_SONGS;

  const normalizedSearch = searchQuery.trim().toLowerCase();
  const hasSearch = normalizedSearch.length > 0;

  const handleSort = (key: SortKey) => {
    const current = tableSorts[playlistKey];
    const nextSort: TableSort =
      !current || current.key !== key
        ? { key, direction: DEFAULT_SORT_DIRECTIONS[key] }
        : {
            key,
            direction: current.direction === "asc" ? "desc" : "asc",
          };

    setTableSorts({ ...tableSorts, [playlistKey]: nextSort });
  };

  const activeSortedSongs = tableSort ? applyTableSort(songs, tableSort, activePlaylist) : songs;
  const activeSortedIds = activeSortedSongs.map((song) => song.id);

  const matches = (value?: string | null) =>
    Boolean(value?.toLowerCase().includes(normalizedSearch));
  const visibleSongs = normalizedSearch
    ? activeSortedSongs.filter(
        (song) => matches(getSongTitle(song)) || matches(song.artist) || matches(song.album),
      )
    : activeSortedSongs;

  const timeListenedLabel =
    activePlaylist.type === "smart" && activePlaylist.days
      ? `Time listened (${activePlaylist.days}d)`
      : "Time listened";

  const isMobile = useIsMobile();
  const allColumns: ColumnDef<typeof playlistTableFeatures, PlaylistSong>[] = [
    {
      id: "title",
      header: "Title",
      meta: {
        sortKey: "title",
        // No width: the title takes whatever space the other columns leave.
        headerClassName: "",
        cellClassName: "font-medium truncate",
      } satisfies SongsColumnMeta,
      cell: ({ row }) => (
        <div className="flex min-w-0 items-center gap-2.5">
          {/* No covers on phones: they're full-size images, and iOS flickers decoding them while scrolling. */}
          {isMobile ? null : <SongCover song={row.original} className="size-6" />}
          <div className="flex min-w-0 flex-col">
            <span className="truncate">{getSongTitle(row.original)}</span>
            {/* Phones have no artist column, so the artist goes under the title. */}
            {row.original.artist ? (
              <span className="truncate text-xs font-normal text-muted-foreground md:hidden">
                {row.original.artist}
              </span>
            ) : null}
          </div>
        </div>
      ),
    },
    {
      id: "artist",
      header: "Artist",
      meta: {
        sortKey: "artist",
        hideOnMobile: true,
        headerClassName: "w-[160px]",
        cellClassName: "truncate text-muted-foreground",
      } satisfies SongsColumnMeta,
      cell: ({ row }) => row.original.artist ?? "",
    },
    {
      id: "album",
      header: "Album",
      meta: {
        sortKey: "album",
        hideOnMobile: true,
        headerClassName: "w-[160px]",
        cellClassName: "truncate text-muted-foreground",
      } satisfies SongsColumnMeta,
      cell: ({ row }) => row.original.album ?? "",
    },
    {
      id: "duration",
      header: "Duration",
      meta: {
        sortKey: "duration",
        hideOnMobile: true,
        headerClassName: "w-[calc(90px*var(--font-scale))]",
        cellClassName: "pr-6 text-right text-muted-foreground",
        numeric: true,
      } satisfies SongsColumnMeta,
      cell: ({ row }) => formatDuration(row.original.duration),
    },
    {
      id: "time",
      header: timeListenedLabel,
      meta: {
        sortKey: "time",
        headerClassName: "w-[calc(84px*var(--font-scale))] md:w-[calc(120px*var(--font-scale))]",
        cellClassName: "pr-3 text-right text-muted-foreground md:pr-6",
        numeric: true,
      } satisfies SongsColumnMeta,
      cell: ({ row }) =>
        formatListeningTime(getListeningSecondsForPlaylist(row.original, activePlaylist)),
    },
    {
      id: "lastPlayed",
      header: "Last played",
      meta: {
        sortKey: "lastPlayed",
        hideOnMobile: true,
        headerClassName: "w-[calc(120px*var(--font-scale))]",
        cellClassName: "text-muted-foreground",
      } satisfies SongsColumnMeta,
      cell: ({ row }) =>
        formatDate(
          "last_played" in row.original ? (row.original.last_played as string | null) : null,
        ),
    },
    {
      id: "dateAdded",
      header: "Date added",
      meta: {
        sortKey: "dateAdded",
        hideOnMobile: true,
        headerClassName: "w-[calc(120px*var(--font-scale))]",
        cellClassName: "text-muted-foreground",
      } satisfies SongsColumnMeta,
      cell: ({ row }) => formatDate(row.original.uploaded_at),
    },
    {
      id: "actions",
      header: "",
      meta: {
        headerClassName: "w-12 text-right",
        // With a mouse, only shown on hover or while its menu is open; always shown on touch.
        cellClassName:
          "text-right transition-opacity pointer-fine:opacity-0 pointer-fine:group-hover/row:opacity-100 pointer-fine:focus-within:opacity-100 pointer-fine:has-[[aria-expanded=true]]:opacity-100",
      } satisfies SongsColumnMeta,
      cell: ({ row }) => (
        <SongActionsMenu trackId={row.original.id} activePlaylist={activePlaylist} />
      ),
    },
  ];
  // Left out rather than hidden with CSS: a fixed-layout table keeps hidden columns' widths.
  const columns = isMobile ? allColumns.filter((column) => !column.meta?.hideOnMobile) : allColumns;

  const table = useTable({
    features: playlistTableFeatures,
    data: visibleSongs,
    columns,
    getRowId: (row) => String(row.id),
  });

  useEffect(() => {
    setActivePlaylistSongIds(activeSortedIds);
  }, [activeSortedIds, setActivePlaylistSongIds]);

  const handleSelectSong = (song: PlaylistSong) => {
    if (usePlaybackStore.getState().currentSongId === song.id) {
      restartCurrentSong();
      return;
    }
    startPlayback({ playlist: activePlaylist, songIds: activeSortedIds, songId: song.id });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex min-h-0 flex-1 flex-col gap-3 px-3 pt-3">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <SidebarTrigger className="-ml-1 size-9 md:hidden [&_svg]:size-5" />
            <h1 className="min-w-0 truncate text-lg font-semibold">{activePlaylist.name}</h1>
            <span className="shrink-0 text-xs text-muted-foreground">
              {isLoading
                ? "Loading songs..."
                : hasSearch
                  ? `${visibleSongs.length} of ${songs.length} songs`
                  : `${songs.length} songs`}
            </span>
          </div>
          <div className="flex w-full min-w-0 items-center justify-end gap-2 md:w-auto md:shrink-0">
            <div className="relative flex-1 md:w-80 md:max-w-[45vw] md:flex-none">
              <Search className="text-muted-foreground pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2" />
              <Input
                type="search"
                placeholder="Search playlist"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                // Borderless until focused; the search icon is enough of a hint.
                className="w-full border-transparent bg-transparent pl-8 shadow-none dark:bg-transparent focus-visible:border-ring"
                aria-label="Search playlist"
              />
            </div>
            <MobileSortControl
              sort={tableSort}
              timeListenedLabel={timeListenedLabel}
              onSort={handleSort}
            />
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
            <div ref={setScrollElement} className="relative flex-1 overflow-auto">
              <Table className="table-fixed" containerClassName="overflow-visible">
                <TableHeader className="sticky top-0 z-10 bg-background/95">
                  {table.getHeaderGroups().map((headerGroup) => (
                    <TableRow
                      key={headerGroup.id}
                      className="bg-background/95 hover:bg-background/95"
                    >
                      {headerGroup.headers.map((header, headerIndex) => {
                        const meta = header.column.columnDef.meta;
                        const sortKey = meta?.sortKey;
                        const isActive = sortKey ? tableSort?.key === sortKey : false;
                        const direction = isActive ? tableSort?.direction : null;
                        const ariaSort = sortKey
                          ? isActive
                            ? direction === "asc"
                              ? "ascending"
                              : "descending"
                            : "none"
                          : undefined;
                        const headerLabel = header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext());

                        return (
                          <TableHead
                            key={header.id}
                            className={cn(
                              "p-0 text-[length:calc(13px*var(--font-scale))]",
                              meta?.headerClassName,
                            )}
                            aria-sort={ariaSort}
                          >
                            {sortKey ? (
                              <button
                                type="button"
                                className={cn(
                                  "group/sort flex h-7 w-full items-center justify-start gap-1 px-2 py-0 text-left text-[length:calc(11px*var(--font-scale))] tracking-wider text-muted-foreground uppercase outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                                  meta?.numeric && "flex-row-reverse pr-6 text-right",
                                  isActive && "text-foreground",
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
                                  <ArrowUpDown className="size-3 opacity-0 group-hover/sort:opacity-60" />
                                )}
                              </button>
                            ) : (
                              headerLabel
                            )}
                          </TableHead>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableHeader>
                <TableBody className="relative">
                  {scrollElement ? (
                    <VirtualSongRows
                      rows={table.getRowModel().rows}
                      scrollElement={scrollElement}
                      columnCount={columns.length}
                      onSelect={handleSelectSong}
                    />
                  ) : null}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
