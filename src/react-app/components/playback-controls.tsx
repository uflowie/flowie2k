import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Gauge,
  Music,
  Pause,
  Play,
  Repeat,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume2,
} from "lucide-react";
import { useShallow } from "zustand/react/shallow";

import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { getAudioUrl, getThumbnailUrl, useSongsQuery } from "@/react-app/lib/queries";
import { usePlaybackStore } from "@/react-app/lib/playback-store";
import { getSongTitle } from "@/react-app/lib/songs";
import { cacheAudio, getCachedAudio } from "@/react-app/lib/audio-cache";
import { numberSetting, useLocalStorage } from "@/react-app/lib/local-storage";

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const volumeSetting = numberSetting("player.volume", 1, { min: 0, max: 1 });
const playbackRateSetting = numberSetting("player.playbackRate", 1, { min: 0.5, max: 1.5 });

const formatTime = (value?: number | null) => {
  if (!value || value <= 0) {
    return "0:00";
  }

  const rounded = Math.floor(value);
  const minutes = Math.floor(rounded / 60);
  const remaining = rounded % 60;
  return `${minutes}:${remaining.toString().padStart(2, "0")}`;
};

const updateMediaSessionPosition = (audio: HTMLAudioElement) => {
  if (
    !("mediaSession" in navigator) ||
    !("setPositionState" in navigator.mediaSession) ||
    !Number.isFinite(audio.duration) ||
    audio.duration <= 0
  ) {
    return;
  }

  try {
    navigator.mediaSession.setPositionState({
      duration: audio.duration,
      playbackRate: audio.playbackRate || 1,
      position: clamp(audio.currentTime, 0, audio.duration),
    });
  } catch {
    // Some browsers expose Media Session without supporting position state.
  }
};

const toggleControlClass = (active: boolean) =>
  [
    "relative size-12 after:absolute after:bottom-1.5 after:left-1/2 after:size-1 after:-translate-x-1/2 after:rounded-full [&_svg]:size-7",
    active
      ? "text-foreground hover:bg-accent after:bg-foreground after:shadow-[0_0_10px_var(--foreground)]"
      : "text-foreground/55 hover:text-foreground after:bg-foreground/25",
  ].join(" ");

// Album art for the current song; falls back to the music icon if it can't load.
function CoverImage({ src }: { src: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return <Music className="size-4 text-foreground/60" />;
  }
  // Decorative: the song title is shown right next to it.
  return (
    <img src={src} alt="" className="size-full object-cover" onError={() => setFailed(true)} />
  );
}

export function PlaybackControls() {
  const playbackPlaylist = usePlaybackStore((state) => state.playbackPlaylist);
  const {
    currentSongId,
    isPlaying,
    shuffle,
    repeat,
    restartToken,
    queueLength,
    activePlaylistSongIds,
    play,
    pause,
    next,
    previous,
    toggleShuffle,
    toggleRepeat,
    setIsPlaying,
  } = usePlaybackStore(
    useShallow((state) => ({
      currentSongId: state.currentSongId,
      isPlaying: state.isPlaying,
      shuffle: state.shuffle,
      repeat: state.repeat,
      restartToken: state.restartToken,
      queueLength: state.queue.length,
      activePlaylistSongIds: state.activePlaylistSongIds,
      play: state.play,
      pause: state.pause,
      next: state.next,
      previous: state.previous,
      toggleShuffle: state.toggleShuffle,
      toggleRepeat: state.toggleRepeat,
      setIsPlaying: state.setIsPlaying,
    })),
  );

  const { data: playbackSongs = [] } = useSongsQuery(playbackPlaylist);

  const currentSong = useMemo(
    () =>
      currentSongId ? (playbackSongs.find((song) => song.id === currentSongId) ?? null) : null,
    [playbackSongs, currentSongId],
  );
  const currentSongLabel = currentSong
    ? getSongTitle(currentSong)
    : currentSongId
      ? "Loading..."
      : "Select a song";
  const currentArtistLabel = currentSong?.artist?.trim();
  const currentAlbumLabel = currentSong?.album?.trim();

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const sourceReadyRef = useRef(false);
  const [volume, setVolume] = useLocalStorage(volumeSetting);
  const [playbackRate, setPlaybackRate] = useLocalStorage(playbackRateSetting);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isSeeking, setIsSeeking] = useState(false);
  const displayCurrentTime = currentSongId ? currentTime : 0;
  const displayDuration = currentSongId ? duration : 0;
  const playbackRateValue = useMemo(() => [playbackRate], [playbackRate]);
  const volumeValue = useMemo(() => [volume], [volume]);
  const seekValue = useMemo(
    () => [Math.min(displayCurrentTime, displayDuration || 0)],
    [displayCurrentTime, displayDuration],
  );
  const canPlay = Boolean(currentSongId || activePlaylistSongIds.length);
  const storageKey = currentSong?.storage_key;
  const fileSize = currentSong?.file_size;

  useEffect(() => {
    if (!("mediaSession" in navigator)) {
      return;
    }

    if (!currentSong) {
      navigator.mediaSession.metadata = null;
      return;
    }

    navigator.mediaSession.metadata = new MediaMetadata({
      title: getSongTitle(currentSong),
      ...(currentArtistLabel ? { artist: currentArtistLabel } : {}),
      ...(currentAlbumLabel ? { album: currentAlbumLabel } : {}),
      ...(currentSong.thumbnail_path
        ? { artwork: [{ src: getThumbnailUrl(currentSong.thumbnail_path) }] }
        : {}),
    });
  }, [currentAlbumLabel, currentArtistLabel, currentSong]);

  useEffect(() => {
    if (!("mediaSession" in navigator)) {
      return;
    }

    navigator.mediaSession.playbackState = currentSongId
      ? isPlaying
        ? "playing"
        : "paused"
      : "none";
  }, [currentSongId, isPlaying]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    sourceReadyRef.current = false;
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
    if (!currentSongId || !storageKey || fileSize === undefined) return;

    const controller = new AbortController();
    let objectUrl: string | undefined;
    void (async () => {
      const cached = await getCachedAudio(storageKey, fileSize);
      if (controller.signal.aborted) return;
      const streamUrl = getAudioUrl(storageKey);
      if (cached) objectUrl = URL.createObjectURL(cached);
      audio.src = objectUrl ?? streamUrl;
      audio.load();
      sourceReadyRef.current = true;
      if (!cached) {
        // Wait until playback starts so the full-file cache download doesn't
        // compete with the audio element for bandwidth before the first note.
        audio.addEventListener(
          "playing",
          () => void cacheAudio(storageKey, fileSize, streamUrl, controller.signal),
          { once: true, signal: controller.signal },
        );
      }
      if (usePlaybackStore.getState().isPlaying) {
        try {
          await audio.play();
        } catch (error) {
          if (
            !controller.signal.aborted &&
            !(error instanceof DOMException && error.name === "AbortError")
          ) {
            setIsPlaying(false);
          }
        }
      }
    })();

    return () => {
      controller.abort();
      sourceReadyRef.current = false;
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [currentSongId, storageKey, fileSize, restartToken, setIsPlaying]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !sourceReadyRef.current) return;

    if (isPlaying) {
      audio.play().catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) setIsPlaying(false);
      });
    } else {
      audio.pause();
    }
  }, [isPlaying, setIsPlaying]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    audio.volume = clamp(volume, 0, 1);
  }, [volume]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    const clampedRate = clamp(playbackRate, 0.5, 1.5);
    audio.playbackRate = clampedRate;
    audio.defaultPlaybackRate = clampedRate;

    const audioElement = audio as HTMLAudioElement & {
      preservesPitch?: boolean;
      mozPreservesPitch?: boolean;
      webkitPreservesPitch?: boolean;
    };
    if (typeof audioElement.preservesPitch === "boolean") {
      audioElement.preservesPitch = false;
    }
    if (typeof audioElement.mozPreservesPitch === "boolean") {
      audioElement.mozPreservesPitch = false;
    }
    if (typeof audioElement.webkitPreservesPitch === "boolean") {
      audioElement.webkitPreservesPitch = false;
    }

    updateMediaSessionPosition(audio);
  }, [playbackRate]);

  const handleTogglePlay = useCallback(() => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  }, [isPlaying, pause, play]);

  const handleSeek = useCallback(
    (value: number) => {
      const audio = audioRef.current;
      if (!audio || !Number.isFinite(value)) {
        return;
      }
      const nextTime = clamp(value, 0, duration || audio.duration || 0);
      audio.currentTime = nextTime;
      setCurrentTime(nextTime);
      updateMediaSessionPosition(audio);
    },
    [duration],
  );

  useEffect(() => {
    if (!("mediaSession" in navigator)) {
      return;
    }

    const registeredActions: MediaSessionAction[] = [];
    const registerAction = (action: MediaSessionAction, handler: MediaSessionActionHandler) => {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
        registeredActions.push(action);
      } catch {
        // Media Session support varies by browser and operating system.
      }
    };

    const seekBy = (offset: number) => {
      const audio = audioRef.current;
      if (!audio) {
        return;
      }
      handleSeek(audio.currentTime + offset);
    };

    registerAction("play", play);
    registerAction("pause", pause);
    registerAction("previoustrack", previous);
    registerAction("nexttrack", next);
    registerAction("seekbackward", ({ seekOffset }) => {
      seekBy(-(seekOffset ?? 10));
    });
    registerAction("seekforward", ({ seekOffset }) => {
      seekBy(seekOffset ?? 10);
    });
    registerAction("seekto", ({ seekTime }) => {
      if (typeof seekTime === "number") {
        handleSeek(seekTime);
      }
    });

    return () => {
      for (const action of registeredActions) {
        try {
          navigator.mediaSession.setActionHandler(action, null);
        } catch {
          // Ignore cleanup errors from partially supported implementations.
        }
      }
    };
  }, [handleSeek, next, pause, play, previous]);

  const handleEnded = useCallback(() => {
    if (repeat && audioRef.current) {
      usePlaybackStore.getState().restartCurrentSong();
      return;
    }

    next();
  }, [next, repeat]);
  const handlePlaybackRateChange = useCallback(
    (value: number[]) => {
      const nextValue = value[0];
      if (typeof nextValue !== "number") {
        return;
      }

      setPlaybackRate(clamp(nextValue, 0.5, 1.5));
    },
    [setPlaybackRate],
  );
  const handleVolumeChange = useCallback(
    (value: number[]) => {
      const nextValue = value[0];
      if (typeof nextValue !== "number") {
        return;
      }

      setVolume(clamp(nextValue, 0, 1));
    },
    [setVolume],
  );

  return (
    <div className="border-t bg-background px-3 py-2">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(28rem,44rem)_minmax(0,1fr)] lg:items-center">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-md border border-border bg-muted/30">
            {currentSong?.thumbnail_path ? (
              <CoverImage
                key={currentSong.thumbnail_path}
                src={getThumbnailUrl(currentSong.thumbnail_path)}
              />
            ) : (
              <Music className="size-4 text-foreground/60" />
            )}
          </div>
          <div className="flex min-w-0 flex-1 flex-col justify-center space-y-0.5">
            <p className="truncate text-sm font-medium">{currentSongLabel}</p>
            {currentArtistLabel || currentAlbumLabel ? (
              <p className="truncate text-xs text-muted-foreground">
                {[currentArtistLabel, currentAlbumLabel].filter(Boolean).join(" · ")}
              </p>
            ) : null}
          </div>
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center justify-center gap-1.5">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={toggleShuffle}
              aria-pressed={shuffle}
              aria-label="Shuffle"
              className={toggleControlClass(shuffle)}
            >
              <Shuffle />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={previous}
              disabled={queueLength === 0}
              aria-label="Previous song"
              className="size-12 [&_svg]:size-7"
            >
              <SkipBack />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={handleTogglePlay}
              disabled={!canPlay}
              aria-label={isPlaying ? "Pause" : "Play"}
              className="size-12 text-foreground [&_svg]:size-7"
            >
              {isPlaying ? <Pause /> : <Play />}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={next}
              disabled={queueLength === 0}
              aria-label="Next song"
              className="size-12 [&_svg]:size-7"
            >
              <SkipForward />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={toggleRepeat}
              aria-pressed={repeat}
              aria-label="Repeat song"
              className={toggleControlClass(repeat)}
            >
              <Repeat />
            </Button>
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-[calc(10px*var(--font-scale))] text-muted-foreground">
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
                const nextValue = value[0];
                if (typeof nextValue !== "number") {
                  return;
                }
                if (nextValue !== displayCurrentTime) {
                  handleSeek(nextValue);
                }
              }}
              onValueCommit={(value) => {
                const nextValue = value[0];
                if (typeof nextValue !== "number") {
                  return;
                }
                handleSeek(nextValue);
              }}
              className="w-full py-2 -my-2"
              disabled={!currentSongId || !displayDuration}
              aria-label="Seek"
            />
            <span className="w-10">{formatTime(displayDuration)}</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          {/* On phones the speed slider gets a full-width row like the seek bar, so it's easy to hit. */}
          <label className="flex w-full items-center gap-2 text-[calc(10px*var(--font-scale))] text-muted-foreground md:w-auto md:gap-1.5 [&_svg]:text-foreground/70">
            <span className="flex w-10 justify-end md:w-auto">
              <Gauge className="size-3.5" />
            </span>
            <Slider
              min={0.5}
              max={1.5}
              step={0.01}
              value={playbackRateValue}
              onValueChange={handlePlaybackRateChange}
              className="-my-2 w-full py-2 md:my-0 md:w-20 md:py-0"
              aria-label="Playback speed"
            />
            <span className="w-10 md:w-8 md:text-right">{Math.round(playbackRate * 100)}%</span>
          </label>
          {/* Phones have hardware volume keys, and iOS ignores volume set from the page. */}
          <label className="hidden items-center gap-1.5 md:flex text-[calc(10px*var(--font-scale))] text-muted-foreground [&_svg]:text-foreground/70">
            <Volume2 className="size-3.5" />
            <Slider
              min={0}
              max={1}
              step={0.01}
              value={volumeValue}
              onValueChange={handleVolumeChange}
              className="w-20"
              aria-label="Volume"
            />
            <span className="w-8 text-right">{Math.round(volume * 100)}%</span>
          </label>
        </div>
      </div>
      <audio
        ref={audioRef}
        preload="metadata"
        onTimeUpdate={(event) => {
          if (isSeeking) {
            return;
          }
          const target = event.currentTarget;
          setCurrentTime(target.currentTime || 0);
          updateMediaSessionPosition(target);
        }}
        onLoadedMetadata={(event) => {
          const nextDuration = event.currentTarget.duration;
          setDuration(Number.isFinite(nextDuration) ? nextDuration : 0);
          updateMediaSessionPosition(event.currentTarget);
        }}
        onEnded={handleEnded}
        onError={() => {
          if (sourceReadyRef.current) setIsPlaying(false);
        }}
        onPlay={(event) => {
          if (sourceReadyRef.current && !event.currentTarget.paused) setIsPlaying(true);
        }}
        onPause={(event) => {
          if (sourceReadyRef.current && event.currentTarget.paused) setIsPlaying(false);
        }}
      />
    </div>
  );
}
