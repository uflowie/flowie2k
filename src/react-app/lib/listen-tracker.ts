import { usePlaybackStore } from "@/react-app/lib/playback-store";

const TRACKER_KEY = "__flowieListenTrackerStarted";
const FLUSH_INTERVAL_MS = 60_000;

type Listen = { track_id: number; playlist_id?: number };
type Pending = Listen & { ms: number };

/**
 * Adds up listening time per track on the client and sends it in batches:
 * once a minute, and when the page is hidden or unloaded.
 */
export const startListenTracker = () => {
  if (typeof window === "undefined") {
    return;
  }

  const windowAny = window as typeof window & {
    [TRACKER_KEY]?: boolean;
  };
  if (windowAny[TRACKER_KEY]) {
    return;
  }
  windowAny[TRACKER_KEY] = true;

  // What's playing right now (null when paused), and up to when it's been counted.
  let current: (Listen & { key: string }) | null = null;
  let countedUntil = 0;
  // Unsent time, keyed by track + playlist.
  const pending = new Map<string, Pending>();

  /** Credits time played since the last call to whatever is playing. */
  const accrue = () => {
    if (!current) {
      return;
    }
    const now = performance.now();
    const entry = pending.get(current.key) ?? { ...current, ms: 0 };
    entry.ms += now - countedUntil;
    pending.set(current.key, entry);
    countedUntil = now;
  };

  const flush = () => {
    accrue();
    const listens: (Listen & { seconds: number })[] = [];
    for (const [key, entry] of pending) {
      const seconds = Math.round(entry.ms / 1000);
      if (seconds > 0) {
        listens.push({ track_id: entry.track_id, playlist_id: entry.playlist_id, seconds });
        // Can go slightly negative; the rounding error carries over to the next flush.
        entry.ms -= seconds * 1000;
      }
      if (key !== current?.key) pending.delete(key);
    }
    if (listens.length === 0) {
      return;
    }
    // Plain fetch with keepalive (not void/client's fetch) so it survives the page unloading.
    void window
      .fetch("/api/analytics/listen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listens }),
        keepalive: true,
      })
      .catch(() => {
        // Listening analytics are best-effort.
      });
  };

  const updateState = (snapshot: ReturnType<typeof usePlaybackStore.getState>) => {
    const { currentSongId, isPlaying, playbackPlaylist } = snapshot;
    const playlistId = playbackPlaylist.type === "custom" ? playbackPlaylist.id : undefined;
    const key = currentSongId && isPlaying ? `${currentSongId}:${playlistId ?? ""}` : null;
    if (key === (current?.key ?? null)) {
      return;
    }
    accrue();
    current =
      key && currentSongId ? { key, track_id: currentSongId, playlist_id: playlistId } : null;
    countedUntil = performance.now();
  };

  usePlaybackStore.subscribe(updateState);
  updateState(usePlaybackStore.getState());

  window.setInterval(flush, FLUSH_INTERVAL_MS);
  // `visibilitychange` is the last reliable signal on mobile; `pagehide` covers desktop unloads.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush();
  });
  window.addEventListener("pagehide", flush);
};
