import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState } from "react"
import type { InferResponseType } from "hono/client"

import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { honoClient } from "@/react-app/lib/api"

export const Route = createFileRoute('/songs')({
  component: AllSongs,
})

type SongsResponse = InferResponseType<typeof honoClient.api.songs.$get>
type Song = SongsResponse["songs"][number]

const fetchSongs = async (): Promise<Song[]> => {
  const response = await honoClient.api.songs.$get()

  if (!response.ok) {
    throw new Error(`Failed to load songs (${response.status})`)
  }

  const data = (await response.json()) as SongsResponse
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

const getSongTitle = (song: Song) => {
  const title = song.title?.trim()
  return title ? title : song.filename
}

function AllSongs() {
  const [currentSong, setCurrentSong] = useState<Song | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const {
    data: songs = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["songs"],
    queryFn: fetchSongs,
  })

  useEffect(() => {
    if (!currentSong || !audioRef.current) {
      return
    }

    audioRef.current.play().catch(() => {
      // Autoplay can be blocked; controls allow manual start.
    })
  }, [currentSong])

  const handlePlay = (song: Song) => {
    if (currentSong?.id === song.id && audioRef.current) {
      audioRef.current.currentTime = 0
      audioRef.current.play().catch(() => {
        // Autoplay can be blocked; controls allow manual start.
      })
      return
    }

    setCurrentSong(song)
  }

  return (
    <div className="flex min-h-svh flex-1 flex-col p-6">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">All Songs</h1>
          </div>
          <div className="text-sm text-muted-foreground">
            {isLoading ? "Loading songs..." : `${songs.length} songs`}
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
            No songs yet. Upload a track to get started.
          </div>
        ) : (
          <div className="rounded-lg border">
            <Table>
              <TableCaption>{`Showing ${songs.length} songs`}</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Artist</TableHead>
                  <TableHead>Album</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Plays</TableHead>
                  <TableHead>Uploaded</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {songs.map((song) => (
                  <TableRow
                    key={song.id}
                    className="cursor-pointer"
                    data-state={
                      currentSong?.id === song.id ? "selected" : undefined
                    }
                    tabIndex={0}
                    onClick={() => handlePlay(song)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault()
                        handlePlay(song)
                      }
                    }}
                  >
                    <TableCell className="font-medium">
                      {getSongTitle(song)}
                    </TableCell>
                    <TableCell>{song.artist ?? "--"}</TableCell>
                    <TableCell>{song.album ?? "--"}</TableCell>
                    <TableCell>{formatDuration(song.duration)}</TableCell>
                    <TableCell>{song.listen_count ?? 0}</TableCell>
                    <TableCell>{formatDate(song.uploaded_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
      {currentSong ? (
        <div className="mt-auto pt-6">
          <div className="rounded-lg border p-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Now playing</p>
                <p className="font-medium">{getSongTitle(currentSong)}</p>
              </div>
              <audio
                ref={audioRef}
                controls
                preload="metadata"
                src={getStreamUrl(currentSong.id)}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
