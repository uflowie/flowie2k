import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  Gauge,
  Pause,
  Play,
  Repeat,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume2,
} from "lucide-react"
import { useShallow } from "zustand/react/shallow"

import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import {
  getPlaylistKey,
  usePlaybackStore,
} from "@/react-app/lib/playback-store"
import { fetchSongsForPlaylist, getStreamUrl } from "@/react-app/lib/songs"
import type { PlaylistSong } from "@/react-app/lib/types"

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

const formatTime = (value?: number | null) => {
  if (!value || value <= 0) {
    return "0:00"
  }

  const rounded = Math.floor(value)
  const minutes = Math.floor(rounded / 60)
  const remaining = rounded % 60
  return `${minutes}:${remaining.toString().padStart(2, "0")}`
}

const getSongTitle = (song: PlaylistSong) => {
  const title = song.title?.trim()
  return title ? title : song.filename
}

const useDebouncedLocalStorage = (
  key: string,
  value: string,
  delayMs = 200,
) => {
  const timeoutRef = useRef<number | null>(null)

  useEffect(() => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current)
    }

    timeoutRef.current = window.setTimeout(() => {
      window.localStorage.setItem(key, value)
    }, delayMs)

    return () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current)
      }
    }
  }, [key, value, delayMs])
}

export function PlaybackControls() {
  const playbackPlaylist = usePlaybackStore((state) => state.playbackPlaylist)
  const playbackPlaylistKey = getPlaylistKey(playbackPlaylist)
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
  )

  const { data: playbackSongs = [] } = useQuery({
    queryKey: ["songs", playbackPlaylistKey],
    queryFn: () => fetchSongsForPlaylist(playbackPlaylist),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  })

  const currentSong = useMemo(
    () =>
      currentSongId
        ? playbackSongs.find((song) => song.id === currentSongId) ?? null
        : null,
    [playbackSongs, currentSongId],
  )
  const currentSongLabel = currentSong
    ? getSongTitle(currentSong)
    : currentSongId
      ? "Loading..."
      : "Select a song"

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const lastSongIdRef = useRef<number | null>(null)
  const lastRestartRef = useRef<number>(restartToken)
  const [volume, setVolume] = useState(() =>
    clamp(readStoredNumber("player.volume", 1), 0, 1),
  )
  const [playbackRate, setPlaybackRate] = useState(() =>
    clamp(readStoredNumber("player.playbackRate", 1), 0.5, 1.5),
  )
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [isSeeking, setIsSeeking] = useState(false)
  const displayCurrentTime = currentSongId ? currentTime : 0
  const displayDuration = currentSongId ? duration : 0
  const playbackRateValue = useMemo(() => [playbackRate], [playbackRate])
  const volumeValue = useMemo(() => [volume], [volume])
  const seekValue = useMemo(
    () => [Math.min(displayCurrentTime, displayDuration || 0)],
    [displayCurrentTime, displayDuration],
  )
  const canPlay = Boolean(currentSongId || activePlaylistSongIds.length)

  useDebouncedLocalStorage("player.volume", String(volume))
  useDebouncedLocalStorage("player.playbackRate", String(playbackRate))

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) {
      return
    }

    const songChanged = currentSongId !== lastSongIdRef.current
    const restarted = restartToken !== lastRestartRef.current

    if (!currentSongId) {
      audio.pause()
      lastSongIdRef.current = currentSongId
      lastRestartRef.current = restartToken
      return
    }

    if (songChanged || restarted) {
      audio.load()
      audio.currentTime = 0
    }

    if (isPlaying) {
      audio.play().catch(() => {
        setIsPlaying(false)
      })
    } else {
      audio.pause()
    }

    lastSongIdRef.current = currentSongId
    lastRestartRef.current = restartToken
  }, [currentSongId, isPlaying, restartToken, setIsPlaying])

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

  const handleTogglePlay = useCallback(() => {
    if (isPlaying) {
      pause()
    } else {
      play()
    }
  }, [isPlaying, pause, play])

  const handleSeek = useCallback(
    (value: number) => {
      const audio = audioRef.current
      if (!audio || !Number.isFinite(value)) {
        return
      }
      const nextTime = clamp(value, 0, duration || audio.duration || 0)
      audio.currentTime = nextTime
      setCurrentTime(nextTime)
    },
    [duration],
  )

  const handleEnded = useCallback(() => {
    if (repeat && audioRef.current) {
      audioRef.current.currentTime = 0
      audioRef.current.play().catch(() => {
        // Autoplay can be blocked; controls allow manual start.
      })
      return
    }

    next()
  }, [next, repeat])

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:items-center">
        <div className="min-w-0">
          <p className="truncate font-medium">{currentSongLabel}</p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button
            type="button"
            variant={shuffle ? "default" : "outline"}
            size="icon"
            onClick={toggleShuffle}
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
            onClick={previous}
            disabled={queueLength === 0}
            aria-label="Previous song"
          >
            <SkipBack />
          </Button>
          <Button
            type="button"
            variant="default"
            size="icon"
            onClick={handleTogglePlay}
            disabled={!canPlay}
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? <Pause /> : <Play />}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={next}
            disabled={queueLength === 0}
            aria-label="Next song"
          >
            <SkipForward />
          </Button>
          <Button
            type="button"
            variant={repeat ? "default" : "outline"}
            size="icon"
            onClick={toggleRepeat}
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
                const nextValue = value[0]
                if (typeof nextValue !== "number") {
                  return
                }
                const clamped = clamp(nextValue, 0.5, 1.5)
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
                const nextValue = value[0]
                if (typeof nextValue !== "number") {
                  return
                }
                const clamped = clamp(nextValue, 0, 1)
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
            const nextValue = value[0]
            if (typeof nextValue !== "number") {
              return
            }
            if (!isSeeking) {
              return
            }
            if (nextValue !== displayCurrentTime) {
              handleSeek(nextValue)
            }
          }}
          onValueCommit={(value) => {
            const nextValue = value[0]
            if (typeof nextValue !== "number") {
              return
            }
            handleSeek(nextValue)
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
  )
}
