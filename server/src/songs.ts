import { Hono } from 'hono'
import { parseBuffer } from 'music-metadata'
import type { Bindings } from './types'

interface Track {
  id: number
  filename: string
  title?: string
  artist?: string
  album?: string
  genre?: string
  duration?: number
  file_size: number
  mime_type: string
  uploaded_at: string
  thumbnail_path?: string
  listen_count: number
  total_seconds: number
  avg_seconds_per_session: number
  first_listen?: string
  last_listen?: string
}

const songs = new Hono<{ Bindings: Bindings }>()

// Upload a song
songs.post('/upload/:filename', async (c) => {
  const filename = c.req.param('filename')
  const body = await c.req.arrayBuffer()
  
  try {
    // Upload original file to R2
    await c.env.MUSIC_BUCKET.put(filename, body, {
      httpMetadata: {
        contentType: 'audio/mpeg'
      }
    })
    
    let metadata: any = {}
    let thumbnailPath: string | null = null
    
    try {
      // Extract metadata from MP3
      const parsedMetadata = await parseBuffer(Buffer.from(body))
      metadata = parsedMetadata.common
      
      // Extract and store album art if present
      if (parsedMetadata.common.picture && parsedMetadata.common.picture.length > 0) {
        const picture = parsedMetadata.common.picture[0]
        const thumbnailFilename = `thumbnails/${filename.replace(/\.[^/.]+$/, '')}.${picture.format.split('/')[1] || 'jpg'}`
        
        await c.env.MUSIC_BUCKET.put(thumbnailFilename, picture.data, {
          httpMetadata: {
            contentType: picture.format
          }
        })
        
        thumbnailPath = thumbnailFilename
      }
    } catch (metadataError) {
      // If metadata extraction fails, continue with basic info
    }
    
    // Store metadata in D1
    const result = await c.env.MUSIC_DB.prepare(`
      INSERT OR REPLACE INTO tracks (
        filename, title, artist, album, genre, duration, file_size, mime_type, thumbnail_path
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      filename,
      metadata.title || filename.replace(/\.[^/.]+$/, ""),
      metadata.artist || null,
      metadata.album || null,
      metadata.genre && metadata.genre.length > 0 ? metadata.genre[0] : null,
      metadata.duration ? Math.round(metadata.duration) : null,
      body.byteLength,
      'audio/mpeg',
      thumbnailPath
    ).run()
    
    return c.json({ 
      message: `File ${filename} uploaded successfully`, 
      size: body.byteLength,
      id: result.meta.last_row_id,
      metadata: {
        title: metadata.title,
        artist: metadata.artist,
        album: metadata.album,
        hasAlbumArt: !!thumbnailPath
      }
    })
  } catch (error) {
    return c.json({ error: 'Upload failed' }, 500)
  }
})

// Get all songs
songs.get('/files', async (c) => {
  try {
    // Get metadata from D1 database with analytics statistics
    const { results } = await c.env.MUSIC_DB.prepare(`
      SELECT 
        t.id, t.filename, t.title, t.artist, t.album, t.genre, t.duration, 
        t.file_size, t.mime_type, t.uploaded_at, t.thumbnail_path,
        COALESCE(COUNT(le.id), 0) as listen_count,
        COALESCE(SUM(le.listened_for_seconds), 0) as total_seconds,
        COALESCE(AVG(le.listened_for_seconds), 0) as avg_seconds_per_session,
        MIN(le.started_at) as first_listen,
        MAX(le.started_at) as last_listen
      FROM tracks t
      LEFT JOIN listening_events le ON t.id = le.track_id
      GROUP BY t.id, t.filename, t.title, t.artist, t.album, t.genre, t.duration, 
               t.file_size, t.mime_type, t.uploaded_at, t.thumbnail_path
      ORDER BY t.uploaded_at DESC
    `).all<Track>()
    
    return c.json({ files: results })
  } catch (error) {
    return c.json({ error: 'Failed to list files' }, 500)
  }
})

// Stream a song
songs.get('/stream/:filename', async (c) => {
  const filename = c.req.param('filename')
  
  try {
    const object = await c.env.MUSIC_BUCKET.get(filename)
    
    if (!object) {
      return c.json({ error: 'File not found' }, 404)
    }

    const range = c.req.header('range')
    const fileSize = object.size

    if (range) {
      const parts = range.replace(/bytes=/, "").split("-")
      const start = parseInt(parts[0], 10)
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1
      const chunksize = (end - start) + 1
      
      const rangeObject = await c.env.MUSIC_BUCKET.get(filename, {
        range: { offset: start, length: chunksize }
      })
      
      if (!rangeObject) {
        return c.json({ error: 'Range not satisfiable' }, 416)
      }
      
      c.header('Content-Range', `bytes ${start}-${end}/${fileSize}`)
      c.header('Accept-Ranges', 'bytes')
      c.header('Content-Length', chunksize.toString())
      c.header('Content-Type', 'audio/mpeg')
      c.status(206)
      
      return c.body(rangeObject.body)
    } else {
      c.header('Content-Length', fileSize.toString())
      c.header('Content-Type', 'audio/mpeg')
      c.header('Accept-Ranges', 'bytes')
      
      return c.body(object.body)
    }
  } catch (error) {
    return c.json({ error: 'Failed to stream file' }, 500)
  }
})

// Get song thumbnail
songs.get('/thumbnail/:filename', async (c) => {
  const filename = c.req.param('filename')
  
  try {
    // Get thumbnail path from database
    const track = await c.env.MUSIC_DB.prepare(`
      SELECT thumbnail_path FROM tracks WHERE filename = ?
    `).bind(filename).first<{ thumbnail_path: string | null }>()
    
    if (!track || !track.thumbnail_path) {
      return c.json({ error: 'Thumbnail not found' }, 404)
    }
    
    // Get thumbnail from R2
    const thumbnail = await c.env.MUSIC_BUCKET.get(track.thumbnail_path)
    
    if (!thumbnail) {
      return c.json({ error: 'Thumbnail file not found' }, 404)
    }
    
    // Determine content type
    const contentType = track.thumbnail_path.endsWith('.png') ? 'image/png' : 'image/jpeg'
    
    c.header('Content-Type', contentType)
    c.header('Cache-Control', 'public, max-age=86400') // Cache for 24 hours
    
    return c.body(thumbnail.body)
  } catch (error) {
    return c.json({ error: 'Failed to get thumbnail' }, 500)
  }
})

// Delete a song
songs.delete('/delete/:filename', async (c) => {
  const filename = c.req.param('filename')
  
  try {
    // Get track info from database
    const track = await c.env.MUSIC_DB.prepare(`
      SELECT id, thumbnail_path FROM tracks WHERE filename = ?
    `).bind(filename).first<{ id: number; thumbnail_path: string | null }>()
    
    if (!track) {
      return c.json({ error: 'File not found' }, 404)
    }
    
    // Delete from R2 storage
    await c.env.MUSIC_BUCKET.delete(filename)
    
    // Delete thumbnail if it exists
    if (track.thumbnail_path) {
      await c.env.MUSIC_BUCKET.delete(track.thumbnail_path)
    }
    
    // Delete from database (this will cascade delete play_events due to foreign key)
    await c.env.MUSIC_DB.prepare(`
      DELETE FROM tracks WHERE filename = ?
    `).bind(filename).run()
    
    return c.json({ message: `File ${filename} deleted successfully` })
  } catch (error) {
    return c.json({ error: 'Failed to delete file' }, 500)
  }
})

export default songs