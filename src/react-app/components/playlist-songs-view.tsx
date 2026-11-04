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
  columnVisibilityFeature,
  createColumnHelper,
  createSortedRowModel,
  flexRender,
  metaHelper,
  rowSortingFeature,
  sortFn_basic,
  tableFeatures,
  type Cell,
  type ReactTable,
  type Row,
  type SortingState,
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

const formatDate = (timestamp?: number) =>
  timestamp === undefined ? "" : dateFormatter.format(timestamp);

/** Undefined for missing or invalid dates, so they sort like missing values. */
const toTimestamp = (value?: string | null) => {
  const timestamp = value ? Date.parse(value) : Number.NaN;
  return Number.isNaN(timestamp) ? undefined : timestamp;
};

const SORT_KEYS = [
  "title",
  "artist",
  "album",
  "duration",
  "time",
  "lastPlayed",
  "dateAdded",
] as const;
type SortKey = (typeof SORT_KEYS)[number];

/** A playlist's sort as stored, which predates TanStack's sorting state. */
type TableSort = {
  key: SortKey;
  direction: "asc" | "desc";
};

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
      if (SORT_KEYS.includes(key as SortKey) && (direction === "asc" || direction === "desc")) {
        sorts[playlistKey] = { key: key as SortKey, direction };
      }
    }
    return sorts;
  },
);

type SongsColumnMeta = {
  /** Right-aligned, for durations and times. */
  numeric?: boolean;
  headerClassName?: string;
  cellClassName?: string;
};

const playlistTableFeatures = tableFeatures({
  columnMeta: metaHelper<SongsColumnMeta>(),
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  columnVisibilityFeature,
});
const columnHelper = createColumnHelper<typeof playlistTableFeatures, PlaylistSong>();
type SongTableRow = Row<typeof playlistTableFeatures, PlaylistSong>;

/** Phones only fit the title, time listened and actions. */
const HIDDEN_ON_MOBILE = {
  artist: false,
  album: false,
  duration: false,
  lastPlayed: false,
  dateAdded: false,
};

// Sorting ignores case and accents; ties are then broken by title, case and accents included.
const baseCollator = new Intl.Collator(undefined, { sensitivity: "base" });
const tieBreakCollator = new Intl.Collator();
const compareText = (first: SongTableRow, second: SongTableRow, columnId: string) =>
  baseCollator.compare(first.getValue<string>(columnId), second.getValue<string>(columnId));
const compareTitles = (first: PlaylistSong, second: PlaylistSong) =>
  tieBreakCollator.compare(getSongTitle(first), getSongTitle(second));

const getListeningSecondsForPlaylist = (song: PlaylistSong, playlist: ActivePlaylist) => {
  if (playlist.type === "smart" && playlist.days) {
    return "window_seconds" in song ? (song.window_seconds as number | null) : null;
  }

  return "seconds_listened" in song ? (song.seconds_listened as number | null) : null;
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

type MobileSortControlProps = {
  options: { id: string; label: string }[];
  sort: SortingState[number] | undefined;
  onSort: (columnId: string) => void;
};

/** Phones hide most columns, so their sort options live in a picker instead. */
function MobileSortControl({ options, sort, onSort }: MobileSortControlProps) {
  const DirectionIcon = sort?.desc ? ArrowDown : ArrowUp;

  return (
    <div className="flex shrink-0 items-center md:hidden">
      <select
        value={sort?.id ?? ""}
        onChange={(event) => onSort(event.target.value)}
        className="h-9 appearance-none rounded-sm bg-transparent px-2 text-xs text-muted-foreground outline-none"
        aria-label="Sort by"
      >
        <option value="" disabled>
          Sort
        </option>
        {options.map(({ id, label }) => (
          <option key={id} value={id}>
            {label}
          </option>
        ))}
      </select>
      {sort ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => onSort(sort.id)}
          aria-label={sort.desc ? "Sorted descending" : "Sorted ascending"}
          className="size-9 text-muted-foreground"
        >
          <DirectionIcon className="size-4" />
        </Button>
      ) : null}
    </div>
  );
}

type SongRowsProps = {
  /** Passed so the rows re-render when the columns change, even if the rows don't. */
  table: ReactTable<typeof playlistTableFeatures, PlaylistSong>;
  rows: SongTableRow[];
  scrollElement: HTMLDivElement;
  onSelect: (song: PlaylistSong) => void;
};

/** Renders only the rows on screen, with spacer rows standing in for the rest. */
function VirtualSongRows({ table, rows, scrollElement, onSelect }: SongRowsProps) {
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
        <TableCell
          colSpan={table.getVisibleLeafColumns().length}
          className="p-0"
          style={{ height }}
        />
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
            cells={row.getVisibleCells()}
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

/** Each playlist's search, kept for the session so switching playlists doesn't lose it. */
const searches = new Map<string, string>();

export function PlaylistSongsView({ playlist: activePlaylist }: { playlist: ActivePlaylist }) {
  const startPlayback = usePlaybackStore((state) => state.startPlayback);
  const restartCurrentSong = usePlaybackStore((state) => state.restartCurrentSong);
  const setOpenView = usePlaybackStore((state) => state.setOpenView);
  const playlistKey = getPlaylistKey(activePlaylist);
  const [searchQuery, setSearchQuery] = useState(() => searches.get(playlistKey) ?? "");
  const [tableSorts, setTableSorts] = useLocalStorage(tableSortsSetting);
  const [scrollElement, setScrollElement] = useState<HTMLDivElement | null>(null);
  const tableSort = tableSorts[playlistKey];
  const sorting: SortingState = tableSort
    ? [{ id: tableSort.key, desc: tableSort.direction === "desc" }]
    : [];

  const { data, isLoading, isError, error, refetch } = useSongsQuery(activePlaylist);
  const songs = data ?? NO_SONGS;
  const songsByTitle = [...songs].sort(compareTitles);

  const normalizedSearch = searchQuery.trim().toLowerCase();
  const hasSearch = normalizedSearch.length > 0;
  const matches = (value?: string | null) =>
    Boolean(value?.toLowerCase().includes(normalizedSearch));

  const timeListenedLabel =
    activePlaylist.type === "smart" && activePlaylist.days
      ? `Time listened (${activePlaylist.days}d)`
      : "Time listened";

  const isMobile = useIsMobile();
  const columns = columnHelper.columns([
    columnHelper.accessor((song) => getSongTitle(song), {
      id: "title",
      header: "Title",
      sortFn: compareText,
      meta: {
        // No width: the title takes whatever space the other columns leave.
        headerClassName: "",
        cellClassName: "font-medium truncate",
      },
      cell: ({ row, getValue }) => (
        <div className="flex min-w-0 items-center gap-2.5">
          {/* Larger on phones, where rows are taller. */}
          <SongCover song={row.original} className="size-9 md:size-6" />
          <div className="flex min-w-0 flex-col">
            <span className="truncate">{getValue()}</span>
            {/* Phones have no artist column, so the artist goes under the title. */}
            {row.original.artist ? (
              <span className="truncate text-xs font-normal text-muted-foreground md:hidden">
                {row.original.artist}
              </span>
            ) : null}
          </div>
        </div>
      ),
    }),
    columnHelper.accessor((song) => song.artist ?? undefined, {
      id: "artist",
      header: "Artist",
      sortFn: compareText,
      meta: {
        headerClassName: "w-[160px]",
        cellClassName: "truncate text-muted-foreground",
      },
      cell: ({ getValue }) => getValue() ?? "",
    }),
    columnHelper.accessor((song) => song.album ?? undefined, {
      id: "album",
      header: "Album",
      sortFn: compareText,
      meta: {
        headerClassName: "w-[160px]",
        cellClassName: "truncate text-muted-foreground",
      },
      cell: ({ getValue }) => getValue() ?? "",
    }),
    columnHelper.accessor((song) => song.duration ?? undefined, {
      id: "duration",
      header: "Duration",
      sortDescFirst: true,
      meta: {
        headerClassName: "w-[calc(90px*var(--font-scale))]",
        cellClassName: "pr-6 text-right text-muted-foreground",
        numeric: true,
      },
      cell: ({ getValue }) => formatDuration(getValue()),
    }),
    columnHelper.accessor(
      (song) => getListeningSecondsForPlaylist(song, activePlaylist) ?? undefined,
      {
        id: "time",
        header: timeListenedLabel,
        sortDescFirst: true,
        meta: {
          headerClassName: "w-[calc(84px*var(--font-scale))] md:w-[calc(120px*var(--font-scale))]",
          cellClassName: "pr-3 text-right text-muted-foreground md:pr-6",
          numeric: true,
        },
        cell: ({ getValue }) => formatListeningTime(getValue()),
      },
    ),
    columnHelper.accessor(
      (song) => toTimestamp("last_played" in song ? (song.last_played as string | null) : null),
      {
        id: "lastPlayed",
        header: "Last played",
        sortDescFirst: true,
        meta: {
          headerClassName: "w-[calc(120px*var(--font-scale))]",
          cellClassName: "text-muted-foreground",
        },
        cell: ({ getValue }) => formatDate(getValue()),
      },
    ),
    columnHelper.accessor((song) => toTimestamp(song.uploaded_at), {
      id: "dateAdded",
      header: "Date added",
      sortDescFirst: true,
      meta: {
        headerClassName: "w-[calc(120px*var(--font-scale))]",
        cellClassName: "text-muted-foreground",
      },
      cell: ({ getValue }) => formatDate(getValue()),
    }),
    columnHelper.display({
      id: "actions",
      header: "",
      enableSorting: false,
      meta: {
        headerClassName: "w-12 text-right",
        // With a mouse, only shown on hover or while its menu is open; always shown on touch.
        cellClassName:
          "text-right transition-opacity pointer-fine:opacity-0 pointer-fine:group-hover/row:opacity-100 pointer-fine:focus-within:opacity-100 pointer-fine:has-[[aria-expanded=true]]:opacity-100",
      },
      cell: ({ row }) => (
        <SongActionsMenu trackId={row.original.id} activePlaylist={activePlaylist} />
      ),
    }),
  ]);

  const table = useTable({
    features: playlistTableFeatures,
    // Sorting keeps tied songs in data order, so starting from title order breaks ties by title.
    data: tableSort ? songsByTitle : songs,
    columns,
    getRowId: (row) => String(row.id),
    // Missing values go after the rest, so last when ascending and first when descending.
    defaultColumn: { sortFn: sortFn_basic, sortUndefined: 1 },
    enableSortingRemoval: false,
    enableMultiSort: false,
    state: { sorting, columnVisibility: isMobile ? HIDDEN_ON_MOBILE : {} },
    onSortingChange: (updater) => {
      const [next] = typeof updater === "function" ? updater(sorting) : updater;
      if (next) {
        const nextSort: TableSort = {
          key: next.id as SortKey,
          direction: next.desc ? "desc" : "asc",
        };
        setTableSorts({ ...tableSorts, [playlistKey]: nextSort });
      }
    },
  });

  const sortedRows = table.getRowModel().rows;
  const visibleRows = normalizedSearch
    ? sortedRows.filter(
        ({ original: song }) =>
          matches(getSongTitle(song)) || matches(song.artist) || matches(song.album),
      )
    : sortedRows;
  // Playing from here queues what's on screen, sorted and searched.
  const view = { playlist: activePlaylist, songIds: visibleRows.map((row) => row.original.id) };
  const sortOptions = table
    .getAllLeafColumns()
    .filter((column) => column.getCanSort())
    .map((column) => ({ id: column.id, label: String(column.columnDef.header) }));

  useEffect(() => {
    setOpenView(view);
    return () => setOpenView(null);
  }, [view, setOpenView]);

  const handleSelectSong = (song: PlaylistSong) => {
    if (usePlaybackStore.getState().currentSongId === song.id) {
      restartCurrentSong();
      return;
    }
    startPlayback(view, song.id);
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
                  ? `${visibleRows.length} of ${songs.length} songs`
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
                onChange={(event) => {
                  setSearchQuery(event.target.value);
                  searches.set(playlistKey, event.target.value);
                }}
                // Borderless until focused; the search icon is enough of a hint.
                className="w-full border-transparent bg-transparent pl-8 shadow-none dark:bg-transparent focus-visible:border-ring"
                aria-label="Search playlist"
              />
            </div>
            <MobileSortControl
              options={sortOptions}
              sort={sorting[0]}
              onSort={(columnId) => table.getColumn(columnId)?.toggleSorting()}
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
        ) : visibleRows.length === 0 ? (
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
                        const canSort = header.column.getCanSort();
                        const direction = header.column.getIsSorted();
                        const ariaSort = !canSort
                          ? undefined
                          : direction === "asc"
                            ? "ascending"
                            : direction === "desc"
                              ? "descending"
                              : "none";
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
                            {canSort ? (
                              <button
                                type="button"
                                className={cn(
                                  "group/sort flex h-7 w-full items-center justify-start gap-1 px-2 py-0 text-left text-[length:calc(11px*var(--font-scale))] tracking-wider text-muted-foreground uppercase outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                                  meta?.numeric && "flex-row-reverse pr-6 text-right",
                                  direction && "text-foreground",
                                  headerIndex === 0 && "pl-0",
                                )}
                                onClick={header.column.getToggleSortingHandler()}
                              >
                                <span>{headerLabel}</span>
                                {direction ? (
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
                      table={table}
                      rows={visibleRows}
                      scrollElement={scrollElement}
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
