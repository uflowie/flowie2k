import { Hono } from 'hono'

const analytics = new Hono<{ Bindings: Env }>()

analytics.post('/listen', async (c) => {
  const { track_id } = await c.req.json()
  
  if (!track_id || typeof track_id !== 'number') {
    return c.json({ error: 'Invalid track_id' }, 400)
  }

  try {
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
    console.error('Error recording listening event:', error)
    return c.json({ error: 'Failed to record listening event', details: (error as any).message }, 500)
  }
})

analytics.get('/stats/:track_id', async (c) => {
  const track_id = parseInt(c.req.param('track_id'))
  
  if (!track_id) {
    return c.json({ error: 'Invalid track_id' }, 400)
  }

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
    `).bind(track_id).first()

    return c.json(result)
  } catch (error) {
    console.error('Error fetching listening stats:', error)
    return c.json({ error: 'Failed to fetch listening stats' }, 500)
  }
})

export default analytics