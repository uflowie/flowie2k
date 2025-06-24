import { useSongs } from '../hooks/useSongs'
import type { Track } from '../types/api'

const SongsList = () => {
  const { data: songs, isLoading, error } = useSongs()

  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <div className="text-lg">Loading songs...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
        <strong>Error:</strong> {error instanceof Error ? error.message : 'Failed to load songs'}
      </div>
    )
  }

  if (!songs || songs.length === 0) {
    return (
      <div className="text-center p-8 text-gray-500">
        No songs found. Upload some music to get started!
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {songs.map((song: Track) => (
        <div key={song.id} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900">
                {song.title || song.filename}
              </h3>
              {song.artist && (
                <p className="text-gray-600">by {song.artist}</p>
              )}
              {song.album && (
                <p className="text-gray-500 text-sm">from {song.album}</p>
              )}
              <div className="flex gap-4 mt-2 text-sm text-gray-400">
                {song.duration && (
                  <span>{Math.floor(song.duration / 60)}:{(song.duration % 60).toString().padStart(2, '0')}</span>
                )}
                <span>{Math.round(song.file_size / 1024 / 1024 * 100) / 100} MB</span>
                {song.listen_count > 0 && (
                  <span>{song.listen_count} plays</span>
                )}
              </div>
            </div>
            {song.thumbnail_path && (
              <div className="ml-4 flex-shrink-0">
                <div className="w-16 h-16 bg-gray-200 rounded flex items-center justify-center">
                  🎵
                </div>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

export default SongsList