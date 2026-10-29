import type { RouteMap } from "void/routes";

type Output<P extends keyof RouteMap, M extends keyof RouteMap[P]> = RouteMap[P][M] extends {
  output: infer O;
}
  ? O
  : never;

export type SongsPayload = Output<"/api/songs", "GET">;
export type PlaylistsPayload = Output<"/api/playlists", "GET">;
export type PlaylistTracksPayload = Output<"/api/playlists/:id/tracks", "GET">;

export type PlaylistSummary = PlaylistsPayload["playlists"][number];
export type Song = SongsPayload["songs"][number];
export type PlaylistTrack = PlaylistTracksPayload["tracks"][number];
export type PlaylistSong = Song | PlaylistTrack;
