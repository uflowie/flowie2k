import { Hono } from 'hono'
import { logger } from 'hono/logger'
import songs from './songs'
import playlists from './playlists'
import analytics from './analytics'

const app = new Hono<{ Bindings: Env }>()

app.use(logger())

app.route('/api/songs', songs)
app.route('/api/playlists', playlists)
app.route('/api/analytics', analytics)

export default app
