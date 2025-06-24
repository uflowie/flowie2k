import { useQuery } from '@tanstack/react-query'
import { songsApi } from '../api/songs'

export const useSongs = () => {
  return useQuery({
    queryKey: ['songs'],
    queryFn: songsApi.getAll,
    select: (data) => data.songs,
  })
}