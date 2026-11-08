import { create } from "zustand";

import { booleanSetting, readSetting, writeSetting } from "@/react-app/lib/local-storage";
import { DEFAULT_PLAYLIST, getPlaylistKey, type ActivePlaylist } from "@/react-app/lib/playlists";

const shuffleSetting = booleanSetting("player.shuffle", false);
const repeatSetting = booleanSetting("player.repeat", false);

const shuffleArray = (items: number[]) => {
  const array = [...items];
  for (let index = array.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    const current = array[index];
    array[index] = array[swapIndex];
    array[swapIndex] = current;
  }
  return array;
};

/** The play order for `songIds`, positioned at the current song; shuffling puts it first. */
const buildQueue = (songIds: number[], shuffle: boolean, currentSongId: number | null) => {
  if (!shuffle || currentSongId === null) {
    const queueIndex = currentSongId === null ? -1 : songIds.indexOf(currentSongId);
    return { queueSource: songIds, queue: songIds, queueIndex };
  }
  const rest = shuffleArray(songIds.filter((id) => id !== currentSongId));
  return { queueSource: songIds, queue: [currentSongId, ...rest], queueIndex: 0 };
};

/** A playlist as shown on screen: its songs in the order they're listed, after sorting and search. */
export type PlaylistView = {
  playlist: ActivePlaylist;
  songIds: number[];
};

type PlaybackStore = {
  /** The playlist on screen, which the play button starts when nothing is loaded. */
  openView: PlaylistView | null;
  playbackPlaylist: ActivePlaylist;
  /**
   * The playing playlist's songs as listed when playback started; the queue is these,
   * maybe shuffled. Later searching, sorting or refreshing doesn't change them.
   */
  queueSource: number[];
  queue: number[];
  /** -1 when nothing has played yet. */
  queueIndex: number;
  currentSongId: number | null;
  isPlaying: boolean;
  shuffle: boolean;
  repeat: boolean;
  restartToken: number;
  /** Set when the playing song should be scrolled into view in its playlist (by its key). */
  revealRequest: string | null;
  revealCurrentSong: () => void;
  clearRevealRequest: () => void;
  setOpenView: (view: PlaylistView | null) => void;
  startPlayback: (view: PlaylistView, songId: number) => void;
  /** For deleted songs, or ones removed from the playing playlist. */
  removeFromQueue: (songId: number) => void;
  restartCurrentSong: () => void;
  play: () => void;
  pause: () => void;
  setIsPlaying: (isPlaying: boolean) => void;
  next: () => void;
  previous: () => void;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
};

export const usePlaybackStore = create<PlaybackStore>((set, get) => ({
  openView: null,
  playbackPlaylist: DEFAULT_PLAYLIST,
  queueSource: [],
  queue: [],
  queueIndex: -1,
  currentSongId: null,
  isPlaying: false,
  shuffle: readSetting(shuffleSetting),
  repeat: readSetting(repeatSetting),
  restartToken: 0,
  revealRequest: null,
  revealCurrentSong: () =>
    set((state) => ({ revealRequest: getPlaylistKey(state.playbackPlaylist) })),
  clearRevealRequest: () => set({ revealRequest: null }),
  setOpenView: (openView) => set({ openView }),
  startPlayback: ({ playlist, songIds }, songId) =>
    set((state) => ({
      playbackPlaylist: playlist,
      currentSongId: songId,
      isPlaying: true,
      ...buildQueue(songIds, state.shuffle, songId),
    })),
  removeFromQueue: (songId) =>
    set((state) => {
      const removedIndex = state.queue.indexOf(songId);
      const queue = state.queue.filter((id) => id !== songId);
      const queueSource = state.queueSource.filter((id) => id !== songId);
      // Keep pointing at the same song, or at the one before a removed current song.
      const queueIndex =
        removedIndex >= 0 && removedIndex <= state.queueIndex
          ? state.queueIndex - 1
          : state.queueIndex;
      if (songId !== state.currentSongId) {
        return { queue, queueSource, queueIndex };
      }
      // The playing song is gone, so move on to the one after it.
      if (!queue.length) {
        return { queue, queueSource, queueIndex: -1, currentSongId: null, isPlaying: false };
      }
      const nextIndex = (queueIndex + 1) % queue.length;
      return { queue, queueSource, queueIndex: nextIndex, currentSongId: queue[nextIndex] };
    }),
  restartCurrentSong: () =>
    set((state) => ({
      restartToken: state.restartToken + 1,
      isPlaying: true,
    })),
  play: () => {
    const { currentSongId, openView, startPlayback } = get();
    if (currentSongId) {
      set({ isPlaying: true });
    } else if (openView?.songIds.length) {
      const { songIds } = openView;
      // Shuffle starts anywhere, not always at the top of the list.
      const index = get().shuffle ? Math.floor(Math.random() * songIds.length) : 0;
      startPlayback(openView, songIds[index]);
    }
  },
  pause: () => set({ isPlaying: false }),
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  next: () => {
    const { queue, queueIndex } = get();
    if (!queue.length) {
      return;
    }
    const nextIndex = (queueIndex + 1) % queue.length;
    set({ queueIndex: nextIndex, currentSongId: queue[nextIndex], isPlaying: true });
  },
  previous: () => {
    const { queue, queueIndex } = get();
    if (!queue.length) {
      return;
    }
    const prevIndex = queueIndex <= 0 ? queue.length - 1 : queueIndex - 1;
    set({ queueIndex: prevIndex, currentSongId: queue[prevIndex], isPlaying: true });
  },
  toggleShuffle: () =>
    set((state) => {
      const shuffle = !state.shuffle;
      writeSetting(shuffleSetting, shuffle);
      return { shuffle, ...buildQueue(state.queueSource, shuffle, state.currentSongId) };
    }),
  toggleRepeat: () =>
    set((state) => {
      const repeat = !state.repeat;
      writeSetting(repeatSetting, repeat);
      return { repeat };
    }),
}));
