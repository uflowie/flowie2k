import { Hono } from 'hono'
import type { Bindings } from './types'
import songs from './songs'
import playlists from './playlists'
import frontend from './frontend'
import analytics from './analytics'

const app = new Hono<{ Bindings: Bindings }>()

// Mount domain routes
app.route('/', frontend)
app.route('/api/songs', songs)
app.route('/api/playlists', playlists)
app.route('/api/analytics', analytics)

export default app
