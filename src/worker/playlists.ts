import { Hono } from 'hono'
import type { Bindings } from './bindings'

interface Playlist {
  id: number
  name: string
  created_at: string
  updated_at: string
  last_played?: string | null
}

const playlists = new Hono<{ Bindings: Bindings }>()
  .get('/', async (c) => {
  try {
    const { results } = (await c.env.MUSIC_DB.prepare(`
      SELECT id, name, created_at, updated_at, last_played FROM playlists 
      ORDER BY COALESCE(last_played, updated_at) DESC
    `).all()) as { results: Playlist[] }

    return c.json({ playlists: results })
  } catch (error) {
    console.error('[PLAYLISTS] Failed to fetch playlists:', error)
    return c.json({ error: 'Failed to fetch playlists' }, 500)
  }
})
  .post('/', async (c) => {
  try {
    const { name } = await c.req.json()

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return c.json({ error: 'Playlist name is required' }, 400)
    }

    const result = await c.env.MUSIC_DB.prepare(`
      INSERT INTO playlists (name) VALUES (?)
    `).bind(name.trim()).run()

    return c.json({
      message: 'Playlist created successfully',
      id: result.meta.last_row_id,
      name: name.trim()
    })
  } catch (error) {
    console.error('[PLAYLISTS] Failed to create playlist:', error)
    return c.json({ error: 'Failed to create playlist' }, 500)
  }
})
  .put('/:id', async (c) => {
  try {
    const playlistId = parseInt(c.req.param('id'))
    const { name } = await c.req.json()

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return c.json({ error: 'Playlist name is required' }, 400)
    }

    const result = await c.env.MUSIC_DB.prepare(`
      UPDATE playlists SET name = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).bind(name.trim(), playlistId).run()

    if (result.meta?.changes === 0) {
      return c.json({ error: 'Playlist not found' }, 404)
    }

    return c.json({
      message: 'Playlist updated successfully',
      id: playlistId,
      name: name.trim()
    })
  } catch (error) {
    console.error(`[PLAYLISTS] Failed to update playlist ID ${c.req.param('id')}:`, error)
    return c.json({ error: 'Failed to update playlist' }, 500)
  }
})
  .delete('/:id', async (c) => {
  try {
    const playlistId = parseInt(c.req.param('id'))

    const result = await c.env.MUSIC_DB.prepare(`
      DELETE FROM playlists WHERE id = ?
    `).bind(playlistId).run()

    if (result.meta?.changes === 0) {
      return c.json({ error: 'Playlist not found' }, 404)
    }

    return c.json({ message: 'Playlist deleted successfully' })
  } catch (error) {
    console.error(`[PLAYLISTS] Failed to delete playlist ID ${c.req.param('id')}:`, error)
    return c.json({ error: 'Failed to delete playlist' }, 500)
  }
})
  .get('/:id/tracks', async (c) => {
  try {
    const playlistId = parseInt(c.req.param('id'))

    // Get playlist info
    const playlist = (await c.env.MUSIC_DB.prepare(`
      SELECT id, name, created_at, updated_at FROM playlists WHERE id = ?
    `).bind(playlistId).first()) as Playlist | null

    if (!playlist) {
      return c.json({ error: 'Playlist not found' }, 404)
    }

    // Get tracks in playlist
    const { results: tracks } = await c.env.MUSIC_DB.prepare(`
      SELECT t.*, pt.added_at as playlist_added_at
      FROM tracks t
      JOIN playlist_tracks pt ON t.id = pt.track_id
      WHERE pt.playlist_id = ?
      ORDER BY pt.added_at ASC
    `).bind(playlistId).all()

    return c.json({ playlist, tracks })
  } catch (error) {
    console.error(`[PLAYLISTS] Failed to fetch tracks for playlist ID ${c.req.param('id')}:`, error)
    return c.json({ error: 'Failed to fetch playlist tracks' }, 500)
  }
})
  .post('/:id/tracks', async (c) => {
  try {
    const playlistId = parseInt(c.req.param('id'))
    const { trackId } = await c.req.json()

    if (!trackId || typeof trackId !== 'number') {
      return c.json({ error: 'Track ID is required' }, 400)
    }

    // Check if playlist exists
    const playlist = await c.env.MUSIC_DB.prepare(`
      SELECT id FROM playlists WHERE id = ?
    `).bind(playlistId).first()

    if (!playlist) {
      return c.json({ error: 'Playlist not found' }, 404)
    }

    // Check if track exists
    const track = await c.env.MUSIC_DB.prepare(`
      SELECT id FROM tracks WHERE id = ?
    `).bind(trackId).first()

    if (!track) {
      return c.json({ error: 'Track not found' }, 404)
    }

    // Add track to playlist
    await c.env.MUSIC_DB.prepare(`
      INSERT OR IGNORE INTO playlist_tracks (playlist_id, track_id) 
      VALUES (?, ?)
    `).bind(playlistId, trackId).run()

    // Update playlist timestamp
    await c.env.MUSIC_DB.prepare(`
      UPDATE playlists SET updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).bind(playlistId).run()

    return c.json({ message: 'Track added to playlist successfully' })
  } catch (error) {
    console.error(`[PLAYLISTS] Failed to add track to playlist ID ${c.req.param('id')}:`, error)
    return c.json({ error: 'Failed to add track to playlist' }, 500)
  }
})
  .delete('/:id/tracks/:trackId', async (c) => {
  try {
    const playlistId = parseInt(c.req.param('id'))
    const trackId = parseInt(c.req.param('trackId'))

    const result = await c.env.MUSIC_DB.prepare(`
      DELETE FROM playlist_tracks WHERE playlist_id = ? AND track_id = ?
    `).bind(playlistId, trackId).run()

    if (result.meta?.changes === 0) {
      return c.json({ error: 'Track not found in playlist' }, 404)
    }

    // Update playlist timestamp
    await c.env.MUSIC_DB.prepare(`
      UPDATE playlists SET updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).bind(playlistId).run()

    return c.json({ message: 'Track removed from playlist successfully' })
  } catch (error) {
    console.error(`[PLAYLISTS] Failed to remove track ${c.req.param('trackId')} from playlist ID ${c.req.param('id')}:`, error)
    return c.json({ error: 'Failed to remove track from playlist' }, 500)
  }
})

export default playlists
