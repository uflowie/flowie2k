import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/songs')({
  component: AllSongs,
})

function AllSongs() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">All Songs</h1>
      <p className="text-muted-foreground">Your music library will appear here.</p>
    </div>
  )
}
