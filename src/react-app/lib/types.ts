import type { InferResponseType } from "hono/client"

type HonoClient = typeof import("./api").honoClient

export type SongsResponse = InferResponseType<HonoClient["api"]["songs"]["$get"]>
export type SongsPayload = Extract<SongsResponse, { songs: unknown }>

export type PlaylistsResponse = InferResponseType<
  HonoClient["api"]["playlists"]["$get"]
>
export type PlaylistsPayload = Extract<PlaylistsResponse, { playlists: unknown }>

export type PlaylistTracksResponse = InferResponseType<
  HonoClient["api"]["playlists"][":id"]["tracks"]["$get"]
>
export type PlaylistTracksPayload = Extract<
  PlaylistTracksResponse,
  { tracks: unknown }
>

export type PlaylistSummary = PlaylistsPayload["playlists"][number]
export type Song = SongsPayload["songs"][number]
export type PlaylistTrack = PlaylistTracksPayload["tracks"][number]
export type PlaylistSong = Song | PlaylistTrack
