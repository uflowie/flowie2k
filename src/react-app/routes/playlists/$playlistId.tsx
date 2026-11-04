import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";

import { getPlaylistKey, resolvePlaylist } from "@/react-app/lib/playlists";
import { usePlaylistsQuery } from "@/react-app/lib/queries";
import { usePlaybackStore } from "@/react-app/lib/playback-store";
import { PlaylistSongsView } from "@/react-app/components/playlist-songs-view";
import type { PlaylistSummary } from "@/react-app/lib/types";

const EMPTY_PLAYLISTS: PlaylistSummary[] = [];

export const Route = createFileRoute("/playlists/$playlistId")({
  component: PlaylistRoute,
});

function PlaylistRoute() {
  const { playlistId } = Route.useParams();
  const { data } = usePlaylistsQuery();
  const resolvedPlaylist = resolvePlaylist(playlistId, data?.playlists ?? EMPTY_PLAYLISTS);
  const playlistKey = getPlaylistKey(resolvedPlaylist);
  const activePlaylist = usePlaybackStore((state) => state.activePlaylist);
  const setActivePlaylist = usePlaybackStore((state) => state.setActivePlaylist);

  useEffect(() => {
    if (
      getPlaylistKey(activePlaylist) === playlistKey &&
      activePlaylist.name === resolvedPlaylist.name
    ) {
      return;
    }
    setActivePlaylist(resolvedPlaylist);
  }, [activePlaylist, playlistKey, resolvedPlaylist, setActivePlaylist]);

  return <PlaylistSongsView key={playlistKey} playlist={resolvedPlaylist} />;
}
