import { createFileRoute } from "@tanstack/react-router";

import { getPlaylistKey, resolvePlaylist } from "@/react-app/lib/playlists";
import { usePlaylistsQuery } from "@/react-app/lib/queries";
import { PlaylistSongsView } from "@/react-app/components/playlist-songs-view";
import type { PlaylistSummary } from "@/react-app/lib/types";

const EMPTY_PLAYLISTS: PlaylistSummary[] = [];

export const Route = createFileRoute("/playlists/$playlistId")({
  component: PlaylistRoute,
});

function PlaylistRoute() {
  const { playlistId } = Route.useParams();
  const { data } = usePlaylistsQuery();
  const playlist = resolvePlaylist(playlistId, data?.playlists ?? EMPTY_PLAYLISTS);

  return <PlaylistSongsView key={getPlaylistKey(playlist)} playlist={playlist} />;
}
