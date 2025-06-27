import { Hono } from 'hono'
import songs from './songs'
import playlists from './playlists'
import analytics from './analytics'
import frontend from './frontend'

const app = new Hono<{ Bindings: Env }>()

app.route('/api/songs', songs)
app.route('/api/playlists', playlists)
app.route('/api/analytics', analytics)
app.route('/', frontend)

export default app
