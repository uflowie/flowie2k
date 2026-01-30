import { Hono } from 'hono'
import { logger } from 'hono/logger'
import songs from './songs'
import playlists from './playlists'
import analytics from './analytics'
import type { Bindings } from './bindings'

const app = new Hono<{ Bindings: Bindings }>()

app.use(logger())

const routes = app
  .route('/api/songs', songs)
  .route('/api/playlists', playlists)
  .route('/api/analytics', analytics)

export default routes
export type AppType = typeof routes
