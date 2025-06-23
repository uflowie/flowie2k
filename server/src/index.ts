import { Hono } from 'hono'

type Bindings = {
  MUSIC_BUCKET: R2Bucket
}

interface R2ObjectInfo {
  key: string
  size: number
  etag: string
  uploaded: Date
}

const app = new Hono<{ Bindings: Bindings }>()

app.get('/test', (c) => {
  return c.html(`<!DOCTYPE html>
<html>
<head><title>Test Frontend</title></head>
<body>
<h1>Test Frontend</h1>
<p>For local testing, open the <code>test-frontend.html</code> file directly in your browser.</p>
<p>The file is located at: <code>server/test-frontend.html</code></p>
</body>
</html>`)
})

app.get('/', (c) => {
  return c.json({ 
    message: 'Music Server API',
    endpoints: {
      'POST /upload/:filename': 'Upload music file',
      'GET /files': 'List uploaded files',
      'GET /stream/:filename': 'Stream music file',
      'GET /test': 'Test frontend info'
    }
  })
})

app.post('/upload/:filename', async (c) => {
  const filename = c.req.param('filename')
  const body = await c.req.arrayBuffer()
  
  try {
    await c.env.MUSIC_BUCKET.put(filename, body, {
      httpMetadata: {
        contentType: 'audio/mpeg'
      }
    })
    
    return c.json({ message: `File ${filename} uploaded successfully`, size: body.byteLength })
  } catch (error) {
    return c.json({ error: 'Upload failed' }, 500)
  }
})

app.get('/files', async (c) => {
  try {
    const objects = await c.env.MUSIC_BUCKET.list()
    const files = objects.objects.map((obj: R2ObjectInfo) => ({
      filename: obj.key,
      size: obj.size
    }))
    
    return c.json({ files })
  } catch (error) {
    return c.json({ error: 'Failed to list files' }, 500)
  }
})

app.get('/stream/:filename', async (c) => {
  const filename = c.req.param('filename')
  
  try {
    const object = await c.env.MUSIC_BUCKET.get(filename)
    
    if (!object) {
      return c.json({ error: 'File not found' }, 404)
    }

    const fileSize = object.size
    const range = c.req.header('range')

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

export default app
