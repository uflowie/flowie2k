import { Navigate, createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/songs")({
  component: SongsRoute,
})

function SongsRoute() {
  return <Navigate to="/playlists/all" />
}
