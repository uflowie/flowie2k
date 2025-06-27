import React, { useState, useEffect, useRef, useCallback } from 'react';
import './VanillaFrontend.css';

interface Track {
  id: number;
  filename: string;
  title?: string;
  artist?: string;
  album?: string;
  genre?: string;
  duration?: number;
  file_size: number;
  mime_type: string;
  uploaded_at: string;
  thumbnail_path?: string;
  total_seconds?: number;
  listen_count?: number;
}

interface Playlist {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
}

interface PlaylistTrack extends Track {
  added_at: string;
}

type StatusType = 'success' | 'error';

const MusicPlayer: React.FC = () => {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [expandedPlaylistId, setExpandedPlaylistId] = useState<number | null>(null);
  const [playlistTracks, setPlaylistTracks] = useState<{ [key: number]: PlaylistTrack[] }>({});
  const [status, setStatus] = useState<{ message: string; type: StatusType } | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [playlistName, setPlaylistName] = useState('');
  const [currentTrackId, setCurrentTrackId] = useState<number | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioPlayerRef = useRef<HTMLAudioElement>(null);
  const listeningIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  const showStatus = useCallback((message: string, type: StatusType = 'success') => {
    setStatus({ message, type });
    setTimeout(() => setStatus(null), 3000);
  }, []);

  const startListeningTracking = useCallback((trackId: number) => {
    if (listeningIntervalRef.current) {
      clearInterval(listeningIntervalRef.current);
    }
    
    setCurrentTrackId(trackId);
    listeningIntervalRef.current = setInterval(async () => {
      try {
        await fetch('/api/analytics/listen', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ track_id: trackId })
        });
      } catch (error) {
        console.error('Failed to track listening:', error);
      }
    }, 1000);
  }, []);

  const stopListeningTracking = useCallback(() => {
    if (listeningIntervalRef.current) {
      clearInterval(listeningIntervalRef.current);
      listeningIntervalRef.current = null;
    }
    setCurrentTrackId(null);
  }, []);

  const loadTracks = useCallback(async () => {
    try {
      const response = await fetch('/api/songs');
      const data = await response.json();
      setTracks(data.songs || []);
    } catch (error) {
      showStatus(`Failed to load tracks: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    }
  }, [showStatus]);

  const loadPlaylists = useCallback(async () => {
    try {
      const response = await fetch('/api/playlists');
      const data = await response.json();
      setPlaylists(data.playlists || []);
    } catch (error) {
      showStatus(`Failed to load playlists: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    }
  }, [showStatus]);

  const loadPlaylistTracks = useCallback(async (playlistId: number) => {
    try {
      const response = await fetch(`/api/playlists/${playlistId}/tracks`);
      const data = await response.json();
      setPlaylistTracks(prev => ({ ...prev, [playlistId]: data.tracks || [] }));
    } catch (error) {
      showStatus(`Failed to load playlist tracks: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    }
  }, [showStatus]);

  const uploadFiles = useCallback(async (files: File[]) => {
    for (const file of files) {
      if (file.type.startsWith('audio/')) {
        try {
          const response = await fetch(`/api/songs/upload/${encodeURIComponent(file.name)}`, {
            method: 'POST',
            body: file
          });

          if (response.ok) {
            const result = await response.json();
            showStatus(`Uploaded ${file.name} (${(result.size / 1024 / 1024).toFixed(2)} MB)`);
          } else {
            throw new Error(`Upload failed: ${response.statusText}`);
          }
        } catch (error) {
          showStatus(`Failed to upload ${file.name}: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
        }
      } else {
        showStatus(`Skipped ${file.name} - not an audio file`, 'error');
      }
    }
    loadTracks();
  }, [showStatus, loadTracks]);

  const playTrack = useCallback((trackId: number, trackName: string) => {
    if (audioPlayerRef.current) {
      const streamUrl = `/api/songs/${trackId}/stream`;
      audioPlayerRef.current.src = streamUrl;
      audioPlayerRef.current.style.display = 'block';
      setCurrentTrackId(trackId);
      audioPlayerRef.current.play();
      showStatus(`Playing: ${trackName}`);
    }
  }, [showStatus]);

  const deleteTrack = useCallback(async (trackId: number, trackName: string) => {
    if (!confirm(`Are you sure you want to delete "${trackName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/songs/${trackId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        showStatus(`Deleted ${trackName}`);
        loadTracks();

        if (currentTrackId === trackId && audioPlayerRef.current) {
          audioPlayerRef.current.pause();
          audioPlayerRef.current.style.display = 'none';
          audioPlayerRef.current.src = '';
          stopListeningTracking();
        }
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Delete failed');
      }
    } catch (error) {
      showStatus(`Failed to delete ${trackName}: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    }
  }, [showStatus, loadTracks, currentTrackId, stopListeningTracking]);

  const createPlaylist = useCallback(async () => {
    if (!playlistName.trim()) {
      showStatus('Please enter a playlist name', 'error');
      return;
    }

    try {
      const response = await fetch('/api/playlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: playlistName.trim() })
      });

      if (response.ok) {
        setPlaylistName('');
        showStatus(`Playlist "${playlistName.trim()}" created successfully`);
        loadPlaylists();
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create playlist');
      }
    } catch (error) {
      showStatus(`Failed to create playlist: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    }
  }, [playlistName, showStatus, loadPlaylists]);

  const editPlaylist = useCallback(async (id: number, currentName: string) => {
    const newName = prompt('Enter new playlist name:', currentName);
    if (!newName || newName.trim() === currentName) return;

    try {
      const response = await fetch(`/api/playlists/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim() })
      });

      if (response.ok) {
        showStatus(`Playlist renamed to "${newName.trim()}"`);
        loadPlaylists();
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update playlist');
      }
    } catch (error) {
      showStatus(`Failed to update playlist: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    }
  }, [showStatus, loadPlaylists]);

  const deletePlaylist = useCallback(async (id: number) => {
    const playlist = playlists.find(p => p.id === id);
    if (!confirm(`Are you sure you want to delete the playlist "${playlist?.name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/playlists/${id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        showStatus('Playlist deleted successfully');
        loadPlaylists();
        setExpandedPlaylistId(null);
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete playlist');
      }
    } catch (error) {
      showStatus(`Failed to delete playlist: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    }
  }, [playlists, showStatus, loadPlaylists]);

  const togglePlaylistTracks = useCallback(async (playlistId: number) => {
    if (expandedPlaylistId === playlistId) {
      setExpandedPlaylistId(null);
    } else {
      setExpandedPlaylistId(playlistId);
      if (!playlistTracks[playlistId]) {
        await loadPlaylistTracks(playlistId);
      }
    }
  }, [expandedPlaylistId, playlistTracks, loadPlaylistTracks]);

  const addToPlaylist = useCallback(async (trackId: number, trackName: string) => {
    if (playlists.length === 0) {
      showStatus('Create a playlist first before adding tracks', 'error');
      return;
    }

    const playlistOptions = playlists.map(p => `${p.id}: ${p.name}`).join('\n');
    const choice = prompt(`Select playlist to add "${trackName}" to:\n\n${playlistOptions}\n\nEnter playlist ID:`);

    if (!choice) return;

    const playlistId = parseInt(choice);
    const playlist = playlists.find(p => p.id === playlistId);

    if (!playlist) {
      showStatus('Invalid playlist ID', 'error');
      return;
    }

    try {
      const response = await fetch(`/api/playlists/${playlistId}/tracks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackId })
      });

      if (response.ok) {
        showStatus(`Track added to "${playlist.name}"`);
        if (expandedPlaylistId === playlistId) {
          loadPlaylistTracks(playlistId);
        }
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Failed to add track to playlist');
      }
    } catch (error) {
      showStatus(`Failed to add track to playlist: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    }
  }, [playlists, showStatus, expandedPlaylistId, loadPlaylistTracks]);

  const removeFromPlaylist = useCallback(async (playlistId: number, trackId: number) => {
    try {
      const response = await fetch(`/api/playlists/${playlistId}/tracks/${trackId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        showStatus('Track removed from playlist');
        loadPlaylistTracks(playlistId);
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Failed to remove track from playlist');
      }
    } catch (error) {
      showStatus(`Failed to remove track from playlist: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    }
  }, [showStatus, loadPlaylistTracks]);

  const handleUploadAreaClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    uploadFiles(files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    uploadFiles(files);
  };

  const handlePlaylistNameKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      createPlaylist();
    }
  };

  useEffect(() => {
    loadTracks();
    loadPlaylists();
  }, [loadTracks, loadPlaylists]);

  useEffect(() => {
    const audioElement = audioPlayerRef.current;
    if (!audioElement) return;

    const handlePlay = () => {
      if (currentTrackId) {
        startListeningTracking(currentTrackId);
      }
    };

    const handlePause = () => {
      stopListeningTracking();
    };

    const handleEnded = () => {
      stopListeningTracking();
    };

    audioElement.addEventListener('play', handlePlay);
    audioElement.addEventListener('pause', handlePause);
    audioElement.addEventListener('ended', handleEnded);

    return () => {
      audioElement.removeEventListener('play', handlePlay);
      audioElement.removeEventListener('pause', handlePause);
      audioElement.removeEventListener('ended', handleEnded);
      if (listeningIntervalRef.current) {
        clearInterval(listeningIntervalRef.current);
      }
    };
  }, [currentTrackId, startListeningTracking, stopListeningTracking]);

  return (
    <div className="container">
      <h1>Music Server Test</h1>

      {status && (
        <div className={`status ${status.type}`}>
          {status.message}
        </div>
      )}

      <h2>Upload Music</h2>
      <div 
        className={`upload-area ${isDragOver ? 'dragover' : ''}`}
        onClick={handleUploadAreaClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <p>Drop MP3 files here or click to select</p>
        <input 
          type="file" 
          ref={fileInputRef}
          accept="audio/*" 
          multiple
          onChange={handleFileInputChange}
        />
      </div>

      <h2>Playlists</h2>
      <div className="container">
        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
          <input 
            type="text" 
            value={playlistName}
            onChange={(e) => setPlaylistName(e.target.value)}
            onKeyPress={handlePlaylistNameKeyPress}
            placeholder="Enter playlist name..."
            style={{ flex: 1, padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
          />
          <button 
            onClick={createPlaylist}
            style={{ padding: '8px 16px', background: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            Create Playlist
          </button>
        </div>
        <div>
          {playlists.length === 0 ? (
            <p>No playlists yet</p>
          ) : (
            playlists.map(playlist => (
              <div key={playlist.id}>
                <div className="playlist-item">
                  <div className="playlist-name" onClick={() => togglePlaylistTracks(playlist.id)}>
                    {playlist.name}
                  </div>
                  <div className="playlist-actions">
                    <button className="edit-btn" onClick={() => editPlaylist(playlist.id, playlist.name)}>
                      Edit
                    </button>
                    <button className="delete-btn" onClick={() => deletePlaylist(playlist.id)}>
                      Delete
                    </button>
                  </div>
                </div>
                {expandedPlaylistId === playlist.id && (
                  <div className="playlist-tracks" style={{ display: 'block' }}>
                    {playlistTracks[playlist.id]?.length === 0 ? (
                      <p style={{ textAlign: 'center', color: '#666', padding: '20px' }}>
                        No tracks in this playlist
                      </p>
                    ) : (
                      <>
                        <div className="playlist-header">
                          <h3 style={{ margin: 0 }}>{playlist.name}</h3>
                          <span className="playlist-track-count">
                            {playlistTracks[playlist.id]?.length || 0} track{playlistTracks[playlist.id]?.length !== 1 ? 's' : ''}
                          </span>
                        </div>
                        {playlistTracks[playlist.id]?.map((track, index) => (
                          <div key={track.id} className="playlist-track">
                            <div className="playlist-track-info">
                              <div style={{ display: 'flex', alignItems: 'center', minWidth: '30px', marginRight: '10px' }}>
                                <span style={{ fontSize: '14px', color: '#999' }}>{index + 1}</span>
                              </div>
                              {track.thumbnail_path ? (
                                <img 
                                  src={`/api/songs/${track.id}/thumbnail`} 
                                  alt="Album art" 
                                  className="playlist-track-thumbnail"
                                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                />
                              ) : (
                                <div className="playlist-track-thumbnail" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999', fontSize: '14px' }}>
                                  ♪
                                </div>
                              )}
                              <div className="playlist-track-details">
                                <div className="playlist-track-title">{track.title || track.filename}</div>
                                <div className="playlist-track-meta">
                                  {track.artist && `${track.artist}`}
                                  {track.artist && track.album && ' • '}
                                  {track.album && `${track.album}`}
                                  {(track.artist || track.album) && track.duration && ' • '}
                                  {track.duration && `${Math.floor(track.duration / 60)}:${(track.duration % 60).toString().padStart(2, '0')}`}
                                </div>
                              </div>
                            </div>
                            <div className="playlist-track-actions">
                              <button className="play-btn" onClick={() => playTrack(track.id, track.title || track.filename)}>
                                Play
                              </button>
                              <button className="delete-btn" onClick={() => removeFromPlaylist(playlist.id, track.id)}>
                                Remove
                              </button>
                            </div>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      <h2>Music Files</h2>
      <div className="file-list">
        {tracks.length === 0 ? (
          <p>No files uploaded yet</p>
        ) : (
          tracks.map(track => {
            const listenTimeText = (track.total_seconds || 0) > 0
              ? `Listened: ${Math.floor((track.total_seconds || 0) / 60)}m ${(track.total_seconds || 0) % 60}s • ${track.listen_count || 0} session${track.listen_count !== 1 ? 's' : ''}`
              : 'Not played yet';

            return (
              <div key={track.id} className="file-item">
                <div className="file-info">
                  {track.thumbnail_path ? (
                    <img 
                      src={`/api/songs/${track.id}/thumbnail`} 
                      alt="Album art" 
                      className="album-art"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  ) : (
                    <div className="album-art" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999', fontSize: '12px' }}>
                      ♪
                    </div>
                  )}
                  <div className="track-details">
                    <strong>{track.title || track.filename}</strong>
                    {track.artist && (<><br /><small>by {track.artist}</small></>)}
                    {track.album && (<><br /><small>from "{track.album}"</small></>)}
                    <br /><small>{(track.file_size / 1024 / 1024).toFixed(2)} MB</small>
                    <div className="listen-stats">{listenTimeText}</div>
                  </div>
                </div>
                <div className="track-actions">
                  <button className="play-btn" onClick={() => playTrack(track.id, track.title || track.filename)}>
                    Play
                  </button>
                  <button className="delete-btn" onClick={() => deleteTrack(track.id, track.title || track.filename)}>
                    Delete
                  </button>
                  <button className="add-to-playlist-btn" onClick={() => addToPlaylist(track.id, track.title || track.filename)}>
                    Add to Playlist
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <h2>Now Playing</h2>
      <audio ref={audioPlayerRef} controls style={{ display: 'none' }}>
        Your browser does not support the audio element.
      </audio>
    </div>
  );
};

export default MusicPlayer;