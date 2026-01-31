import { Hono, type Env } from 'hono'
import { zValidator, type Hook } from '@hono/zod-validator'
import { z } from 'zod'
import type { Bindings } from './bindings'
import type {
  IdRow,
  PlaylistBaseRow,
  PlaylistRow,
  PlaylistTrackRow,
} from './db-types'

const zodError = ((result, c) => {
  if (!result.success) {
    const message = result.error.issues[0]?.message ?? 'Invalid request'
    return c.json({ error: message }, 400)
  }
}) satisfies Hook<
  unknown,
  Env,
  string,
  'json' | 'param' | 'query',
  { error: string },
  z.ZodType
>

const playlistIdParamSchema = z.object({
  id: z.coerce.number().int().positive()
})

const playlistTrackParamSchema = z.object({
  id: z.coerce.number().int().positive(),
  trackId: z.coerce.number().int().positive()
})

const playlistNameSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { message: 'Playlist name is required' })
})

const playlistTrackBodySchema = z.object({
  trackId: z
    .number()
    .int()
    .positive({ message: 'Track ID is required' })
})

const playlists = new Hono<{ Bindings: Bindings }>()
  .get('/', async (c) => {
    try {
      const { results } = await c.env.MUSIC_DB.prepare(`
        SELECT id, name, created_at, updated_at, last_played FROM playlists 
        ORDER BY COALESCE(last_played, updated_at) DESC
      `).all<PlaylistRow>()

      return c.json({ playlists: results })
    } catch (error) {
      console.error('[PLAYLISTS] Failed to fetch playlists:', error)
      return c.json({ error: 'Failed to fetch playlists' }, 500)
    }
  })
  .post('/', zValidator('json', playlistNameSchema, zodError), async (c) => {
    const { name } = c.req.valid('json')

    try {
      const result = await c.env.MUSIC_DB.prepare(`
        INSERT INTO playlists (name) VALUES (?)
      `).bind(name).run()

      return c.json({
        message: 'Playlist created successfully',
        id: result.meta.last_row_id,
        name
      })
    } catch (error) {
      console.error('[PLAYLISTS] Failed to create playlist:', error)
      return c.json({ error: 'Failed to create playlist' }, 500)
    }
  })
  .put(
    '/:id',
    zValidator('param', playlistIdParamSchema, zodError),
    zValidator('json', playlistNameSchema, zodError),
    async (c) => {
      const { id: playlistId } = c.req.valid('param')
      const { name } = c.req.valid('json')

      try {
        const result = await c.env.MUSIC_DB.prepare(`
          UPDATE playlists SET name = ?, updated_at = CURRENT_TIMESTAMP 
          WHERE id = ?
        `).bind(name, playlistId).run()

        if (result.meta?.changes === 0) {
          return c.json({ error: 'Playlist not found' }, 404)
        }

        return c.json({
          message: 'Playlist updated successfully',
          id: playlistId,
          name
        })
      } catch (error) {
        console.error(`[PLAYLISTS] Failed to update playlist ID ${playlistId}:`, error)
        return c.json({ error: 'Failed to update playlist' }, 500)
      }
    }
  )
  .delete('/:id', zValidator('param', playlistIdParamSchema, zodError), async (c) => {
    const { id: playlistId } = c.req.valid('param')

    try {
      const result = await c.env.MUSIC_DB.prepare(`
        DELETE FROM playlists WHERE id = ?
      `).bind(playlistId).run()

      if (result.meta?.changes === 0) {
        return c.json({ error: 'Playlist not found' }, 404)
      }

      return c.json({ message: 'Playlist deleted successfully' })
    } catch (error) {
      console.error(`[PLAYLISTS] Failed to delete playlist ID ${playlistId}:`, error)
      return c.json({ error: 'Failed to delete playlist' }, 500)
    }
  })
  .get('/:id/tracks', zValidator('param', playlistIdParamSchema, zodError), async (c) => {
    const { id: playlistId } = c.req.valid('param')

    try {
      // Get playlist info
      const playlist = await c.env.MUSIC_DB.prepare(`
        SELECT id, name, created_at, updated_at FROM playlists WHERE id = ?
      `).bind(playlistId).first<PlaylistBaseRow>()

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
      `).bind(playlistId).all<PlaylistTrackRow>()

      return c.json({ playlist, tracks })
    } catch (error) {
      console.error(`[PLAYLISTS] Failed to fetch tracks for playlist ID ${playlistId}:`, error)
      return c.json({ error: 'Failed to fetch playlist tracks' }, 500)
    }
  })
  .post(
    '/:id/tracks',
    zValidator('param', playlistIdParamSchema, zodError),
    zValidator('json', playlistTrackBodySchema, zodError),
    async (c) => {
      const { id: playlistId } = c.req.valid('param')
      const { trackId } = c.req.valid('json')

      try {
        // Check if playlist exists
        const playlist = await c.env.MUSIC_DB.prepare(`
          SELECT id FROM playlists WHERE id = ?
        `).bind(playlistId).first<IdRow>()

        if (!playlist) {
          return c.json({ error: 'Playlist not found' }, 404)
        }

        // Check if track exists
        const track = await c.env.MUSIC_DB.prepare(`
          SELECT id FROM tracks WHERE id = ?
        `).bind(trackId).first<IdRow>()

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
        console.error(`[PLAYLISTS] Failed to add track to playlist ID ${playlistId}:`, error)
        return c.json({ error: 'Failed to add track to playlist' }, 500)
      }
    }
  )
  .delete(
    '/:id/tracks/:trackId',
    zValidator('param', playlistTrackParamSchema, zodError),
    async (c) => {
      const { id: playlistId, trackId } = c.req.valid('param')

      try {
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
        console.error(`[PLAYLISTS] Failed to remove track ${trackId} from playlist ID ${playlistId}:`, error)
        return c.json({ error: 'Failed to remove track from playlist' }, 500)
      }
    }
  )

export default playlists
