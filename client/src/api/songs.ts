import type { SongsResponse } from '../types/api'

const API_BASE_URL = 'http://localhost:43689' // Cloudflare Workers dev URL

export const songsApi = {
  getAll: async (): Promise<SongsResponse> => {
    const response = await fetch(`${API_BASE_URL}/api/songs/`)
    
    if (!response.ok) {
      throw new Error(`Failed to fetch songs: ${response.statusText}`)
    }
    
    return response.json()
  }
}