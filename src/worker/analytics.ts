import { Hono, type Env } from 'hono'
import { zValidator, type Hook } from '@hono/zod-validator'
import { z } from 'zod'
import type { Bindings } from './bindings'
import type { ListeningStatsRow } from './db-types'

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
const listenBodySchema = z.object({
  track_id: z
    .number()
    .int()
    .positive({ message: 'Invalid track_id' }),
  playlist_id: z
    .number()
    .int()
    .positive({ message: 'Invalid playlist_id' })
    .optional()
})

const statsParamSchema = z.object({
  track_id: z.coerce
    .number()
    .int()
    .positive({ message: 'Invalid track_id' })
})

const analytics = new Hono<{ Bindings: Bindings }>()
  .post('/listen', zValidator('json', listenBodySchema, zodError), async (c) => {
    const { track_id, playlist_id } = c.req.valid('json')

    try {
      const trackUpdate = await c.env.MUSIC_DB.prepare(`
        UPDATE tracks
        SET seconds_listened = COALESCE(seconds_listened, 0) + 1,
            last_played = CURRENT_TIMESTAMP
        WHERE id = ?
      `).bind(track_id).run()

      if (trackUpdate.meta.changes === 0) {
        return c.json({ error: 'Track not found' }, 404)
      }

      if (playlist_id !== undefined) {
        await c.env.MUSIC_DB.prepare(`
          UPDATE playlists
          SET last_played = CURRENT_TIMESTAMP
          WHERE id = ?
        `).bind(playlist_id).run()
      }

      // First try to update the most recent event if we're within 3 seconds of when it should end
      const updateResult = await c.env.MUSIC_DB.prepare(`
        UPDATE listening_events 
        SET listened_for_seconds = listened_for_seconds + 1
        WHERE id = (
          SELECT id FROM listening_events 
          WHERE track_id = ? 
          AND (julianday('now') - julianday(started_at, '+' || listened_for_seconds || ' seconds')) * 86400 <= 3.0
          ORDER BY started_at DESC 
          LIMIT 1
        )
      `).bind(track_id).run()

      // If no rows were updated, create a new event
      if (updateResult.meta.changes === 0) {
        await c.env.MUSIC_DB.prepare(`
          INSERT INTO listening_events (track_id, listened_for_seconds, started_at)
          VALUES (?, 1, CURRENT_TIMESTAMP)
        `).bind(track_id).run()
      }

      return c.json({ success: true })
    } catch (error) {
      const details = error instanceof Error ? error.message : String(error)
      console.error(
        `[ANALYTICS] Failed to record listening event for track ID ${track_id}:`,
        error
      )
      return c.json(
        { error: 'Failed to record listening event', details },
        500
      )
    }
  })
  .get('/stats/:track_id', zValidator('param', statsParamSchema, zodError), async (c) => {
    const { track_id } = c.req.valid('param')

    try {
      const result = await c.env.MUSIC_DB.prepare(`
        SELECT 
          COUNT(*) as listen_count,
          SUM(listened_for_seconds) as total_seconds,
          AVG(listened_for_seconds) as avg_seconds_per_session,
          MIN(started_at) as first_listen,
          MAX(started_at) as last_listen
        FROM listening_events 
        WHERE track_id = ?
      `).bind(track_id).first<ListeningStatsRow>()

      return c.json(result)
    } catch (error) {
      console.error(
        `[ANALYTICS] Failed to fetch listening stats for track ID ${track_id}:`,
        error
      )
      return c.json({ error: 'Failed to fetch listening stats' }, 500)
    }
  })

export default analytics
