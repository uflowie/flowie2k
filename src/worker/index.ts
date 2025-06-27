import { Hono } from 'hono'
import { logger } from 'hono/logger'
import songs from './songs'
import playlists from './playlists'
import analytics from './analytics'

const app = new Hono<{ Bindings: Env }>()

app.use(logger())

const routes = app
    .route('/api/songs', songs)
    .route('/api/playlists', playlists)
    .route('/api/analytics', analytics)

export default app
export type AppType = typeof routes
