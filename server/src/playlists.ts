import { Hono } from 'hono'
import type { Bindings, Playlist } from './types'

const playlists = new Hono<{ Bindings: Bindings }>()

// Get all playlists
playlists.get('/', async (c) => {
  try {
    const { results } = await c.env.MUSIC_DB.prepare(`
      SELECT id, name, created_at, updated_at FROM playlists 
      ORDER BY updated_at DESC
    `).all<Playlist>()

    return c.json({ playlists: results })
  } catch (error) {
    return c.json({ error: 'Failed to fetch playlists' }, 500)
  }
})

// Create a new playlist
playlists.post('/', async (c) => {
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
    return c.json({ error: 'Failed to create playlist' }, 500)
  }
})

// Update playlist name
playlists.put('/:id', async (c) => {
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

    if (result.changes === 0) {
      return c.json({ error: 'Playlist not found' }, 404)
    }

    return c.json({
      message: 'Playlist updated successfully',
      id: playlistId,
      name: name.trim()
    })
  } catch (error) {
    return c.json({ error: 'Failed to update playlist' }, 500)
  }
})

// Delete playlist
playlists.delete('/:id', async (c) => {
  try {
    const playlistId = parseInt(c.req.param('id'))

    const result = await c.env.MUSIC_DB.prepare(`
      DELETE FROM playlists WHERE id = ?
    `).bind(playlistId).run()

    if (result.changes === 0) {
      return c.json({ error: 'Playlist not found' }, 404)
    }

    return c.json({ message: 'Playlist deleted successfully' })
  } catch (error) {
    return c.json({ error: 'Failed to delete playlist' }, 500)
  }
})

// Get playlist with tracks
playlists.get('/:id/tracks', async (c) => {
  try {
    const playlistId = parseInt(c.req.param('id'))

    // Get playlist info
    const playlist = await c.env.MUSIC_DB.prepare(`
      SELECT id, name, created_at, updated_at FROM playlists WHERE id = ?
    `).bind(playlistId).first<Playlist>()

    if (!playlist) {
      return c.json({ error: 'Playlist not found' }, 404)
    }

    // Get tracks in playlist
    const { results: tracks } = await c.env.MUSIC_DB.prepare(`
      SELECT t.*, pt.position, pt.added_at as playlist_added_at
      FROM tracks t
      JOIN playlist_tracks pt ON t.id = pt.track_id
      WHERE pt.playlist_id = ?
      ORDER BY pt.position ASC
    `).bind(playlistId).all()

    return c.json({ playlist, tracks })
  } catch (error) {
    console.log('Error fetching playlist tracks:', error)
    return c.json({ error: 'Failed to fetch playlist tracks' }, 500)
  }
})

// Add track to playlist
playlists.post('/:id/tracks', async (c) => {
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

    // Get next position
    const nextPosition = await c.env.MUSIC_DB.prepare(`
      SELECT COALESCE(MAX(position), -1) + 1 as next_position 
      FROM playlist_tracks WHERE playlist_id = ?
    `).bind(playlistId).first<{ next_position: number }>()

    // Add track to playlist
    await c.env.MUSIC_DB.prepare(`
      INSERT OR IGNORE INTO playlist_tracks (playlist_id, track_id, position) 
      VALUES (?, ?, ?)
    `).bind(playlistId, trackId, nextPosition?.next_position || 0).run()

    // Update playlist timestamp
    await c.env.MUSIC_DB.prepare(`
      UPDATE playlists SET updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).bind(playlistId).run()

    return c.json({ message: 'Track added to playlist successfully' })
  } catch (error) {
    return c.json({ error: 'Failed to add track to playlist' }, 500)
  }
})

// Remove track from playlist
playlists.delete('/:id/tracks/:trackId', async (c) => {
  try {
    const playlistId = parseInt(c.req.param('id'))
    const trackId = parseInt(c.req.param('trackId'))

    const result = await c.env.MUSIC_DB.prepare(`
      DELETE FROM playlist_tracks WHERE playlist_id = ? AND track_id = ?
    `).bind(playlistId, trackId).run()

    if (result.changes === 0) {
      return c.json({ error: 'Track not found in playlist' }, 404)
    }

    // Update playlist timestamp
    await c.env.MUSIC_DB.prepare(`
      UPDATE playlists SET updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).bind(playlistId).run()

    return c.json({ message: 'Track removed from playlist successfully' })
  } catch (error) {
    return c.json({ error: 'Failed to remove track from playlist' }, 500)
  }
})

export default playlists