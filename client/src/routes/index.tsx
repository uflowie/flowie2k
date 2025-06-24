import { createFileRoute } from '@tanstack/react-router'
import SongsList from '../components/SongsList'

export const Route = createFileRoute('/')({
  component: Index,
})

function Index() {
  return (
    <div className="p-2">
      <h2 className="text-2xl font-semibold mb-4">All Songs</h2>
      <SongsList />
    </div>
  )
}