import { Hono } from 'hono'
import type { Bindings } from './types'
import songs from './songs'
import playlists from './playlists'
import frontend from './frontend'

const app = new Hono<{ Bindings: Bindings }>()

// Mount domain routes
app.route('/', frontend)
app.route('/', songs)
app.route('/api/playlists', playlists)

export default app
