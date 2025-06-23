import { Hono } from 'hono'
import { parseBuffer } from 'music-metadata'

type Bindings = {
  MUSIC_BUCKET: R2Bucket
  MUSIC_DB: D1Database
}

interface R2ObjectInfo {
  key: string
  size: number
  etag: string
  uploaded: Date
}

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
}

const app = new Hono<{ Bindings: Bindings }>()

const HTML_CONTENT = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Music Server Test</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            background: #f5f5f5;
        }
        .container {
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            margin-bottom: 20px;
        }
        h1, h2 {
            color: #333;
        }
        .upload-area {
            border: 2px dashed #ccc;
            border-radius: 8px;
            padding: 40px;
            text-align: center;
            cursor: pointer;
            transition: border-color 0.3s;
        }
        .upload-area:hover {
            border-color: #007bff;
        }
        .upload-area.dragover {
            border-color: #007bff;
            background: #f0f8ff;
        }
        input[type="file"] {
            display: none;
        }
        .file-list {
            margin-top: 20px;
        }
        .file-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px;
            border: 1px solid #ddd;
            border-radius: 4px;
            margin-bottom: 5px;
            background: #f9f9f9;
        }
        .file-info {
            display: flex;
            align-items: center;
            flex-grow: 1;
        }
        .album-art {
            width: 50px;
            height: 50px;
            border-radius: 4px;
            margin-right: 10px;
            object-fit: cover;
            background: #ddd;
        }
        .track-details {
            flex-grow: 1;
        }
        .play-btn {
            background: #007bff;
            color: white;
            border: none;
            padding: 5px 10px;
            border-radius: 4px;
            cursor: pointer;
            margin-right: 5px;
        }
        .play-btn:hover {
            background: #0056b3;
        }
        .delete-btn {
            background: #dc3545;
            color: white;
            border: none;
            padding: 5px 10px;
            border-radius: 4px;
            cursor: pointer;
        }
        .delete-btn:hover {
            background: #c82333;
        }
        .track-actions {
            display: flex;
            gap: 5px;
        }
        audio {
            width: 100%;
            margin-top: 10px;
        }
        .status {
            padding: 10px;
            border-radius: 4px;
            margin-bottom: 10px;
        }
        .status.success {
            background: #d4edda;
            color: #155724;
            border: 1px solid #c3e6cb;
        }
        .status.error {
            background: #f8d7da;
            color: #721c24;
            border: 1px solid #f5c6cb;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Music Server Test</h1>
        
        <div id="status"></div>
        
        <h2>Upload Music</h2>
        <div class="upload-area" id="uploadArea">
            <p>Drop MP3 files here or click to select</p>
            <input type="file" id="fileInput" accept="audio/*" multiple>
        </div>
        
        <h2>Music Files</h2>
        <div class="file-list" id="fileList">
            <p>No files uploaded yet</p>
        </div>
        
        <h2>Now Playing</h2>
        <audio id="audioPlayer" controls style="display: none;">
            Your browser does not support the audio element.
        </audio>
    </div>

    <script>
        const uploadArea = document.getElementById('uploadArea');
        const fileInput = document.getElementById('fileInput');
        const fileList = document.getElementById('fileList');
        const audioPlayer = document.getElementById('audioPlayer');
        const status = document.getElementById('status');

        function showStatus(message, type = 'success') {
            status.innerHTML = \`<div class="status \${type}">\${message}</div>\`;
            setTimeout(() => status.innerHTML = '', 3000);
        }

        uploadArea.addEventListener('click', () => fileInput.click());

        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });

        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('dragover');
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            const files = Array.from(e.dataTransfer.files);
            uploadFiles(files);
        });

        fileInput.addEventListener('change', (e) => {
            const files = Array.from(e.target.files);
            uploadFiles(files);
        });

        async function uploadFiles(files) {
            for (const file of files) {
                if (file.type.startsWith('audio/')) {
                    await uploadFile(file);
                } else {
                    showStatus(\`Skipped \${file.name} - not an audio file\`, 'error');
                }
            }
            loadFileList();
        }

        async function uploadFile(file) {
            try {
                const response = await fetch(\`/upload/\${encodeURIComponent(file.name)}\`, {
                    method: 'POST',
                    body: file
                });
                
                if (response.ok) {
                    const result = await response.json();
                    showStatus(\`Uploaded \${file.name} (\${(result.size / 1024 / 1024).toFixed(2)} MB)\`);
                } else {
                    throw new Error(\`Upload failed: \${response.statusText}\`);
                }
            } catch (error) {
                showStatus(\`Failed to upload \${file.name}: \${error.message}\`, 'error');
            }
        }

        async function loadFileList() {
            try {
                const response = await fetch('/files');
                const data = await response.json();
                
                if (data.files.length === 0) {
                    fileList.innerHTML = '<p>No files uploaded yet</p>';
                    return;
                }
                
                fileList.innerHTML = data.files.map(file => \`
                    <div class="file-item">
                        <div class="file-info">
                            \${file.thumbnail_path ? 
                                \`<img src="/thumbnail/\${encodeURIComponent(file.filename)}" alt="Album art" class="album-art" onerror="this.style.display='none'">\` :
                                \`<div class="album-art" style="display: flex; align-items: center; justify-content: center; color: #999; font-size: 12px;">♪</div>\`
                            }
                            <div class="track-details">
                                <strong>\${file.title || file.filename}</strong>
                                \${file.artist ? \`<br><small>by \${file.artist}</small>\` : ''}
                                \${file.album ? \`<br><small>from "\${file.album}"</small>\` : ''}
                                <br><small>\${(file.file_size / 1024 / 1024).toFixed(2)} MB</small>
                            </div>
                        </div>
                        <div class="track-actions">
                            <button class="play-btn" onclick="playFile('\${file.filename}')">Play</button>
                            <button class="delete-btn" onclick="deleteFile('\${file.filename}')">Delete</button>
                        </div>
                    </div>
                \`).join('');
            } catch (error) {
                showStatus(\`Failed to load file list: \${error.message}\`, 'error');
            }
        }

        function playFile(filename) {
            const streamUrl = \`/stream/\${encodeURIComponent(filename)}\`;
            audioPlayer.src = streamUrl;
            audioPlayer.style.display = 'block';
            audioPlayer.play();
            showStatus(\`Playing: \${filename}\`);
        }

        async function deleteFile(filename) {
            if (!confirm(\`Are you sure you want to delete "\${filename}"? This action cannot be undone.\`)) {
                return;
            }
            
            try {
                const response = await fetch(\`/delete/\${encodeURIComponent(filename)}\`, {
                    method: 'DELETE'
                });
                
                if (response.ok) {
                    showStatus(\`Deleted \${filename}\`);
                    loadFileList(); // Refresh the list
                    
                    // Stop playing if this file is currently playing
                    if (audioPlayer.src.includes(encodeURIComponent(filename))) {
                        audioPlayer.pause();
                        audioPlayer.style.display = 'none';
                        audioPlayer.src = '';
                    }
                } else {
                    const error = await response.json();
                    throw new Error(error.error || 'Delete failed');
                }
            } catch (error) {
                showStatus(\`Failed to delete \${filename}: \${error.message}\`, 'error');
            }
        }

        // Load file list on page load
        loadFileList();
    </script>
</body>
</html>`

app.get('/', (c) => {
  return c.html(HTML_CONTENT)
})

app.post('/upload/:filename', async (c) => {
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

app.get('/files', async (c) => {
  try {
    // Get metadata from D1 database
    const { results } = await c.env.MUSIC_DB.prepare(`
      SELECT id, filename, title, artist, album, genre, duration, file_size, mime_type, uploaded_at, thumbnail_path
      FROM tracks 
      ORDER BY uploaded_at DESC
    `).all<Track>()
    
    return c.json({ files: results })
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

app.get('/thumbnail/:filename', async (c) => {
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

app.delete('/delete/:filename', async (c) => {
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

export default app
