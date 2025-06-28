import React, { useCallback, useRef, useState } from 'react';
import { client } from './api-client';
import './MainContent.css';

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

interface PlaylistTrack extends Track {
    added_at: string;
}

interface Playlist {
    id: number;
    name: string;
    created_at: string;
    updated_at: string;
}

interface MainContentProps {
    selectedPlaylistId: number | null;
    tracks: Track[];
    playlistTracks: { [key: number]: PlaylistTrack[] };
    playlists: Playlist[];
    onTrackPlay: (trackId: number, trackName: string) => void;
    onTracksChange: () => void;
    onPlaylistTracksChange: (playlistId: number) => void;
    onShowStatus: (message: string, type?: 'success' | 'error') => void;
}

const MainContent: React.FC<MainContentProps> = ({
    selectedPlaylistId,
    tracks,
    playlistTracks,
    playlists,
    onTrackPlay,
    onTracksChange,
    onPlaylistTracksChange,
    onShowStatus
}) => {
    const [isDragOver, setIsDragOver] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const currentTracks = selectedPlaylistId === null 
        ? tracks 
        : playlistTracks[selectedPlaylistId] || [];

    const playlistName = selectedPlaylistId === null 
        ? 'All Songs' 
        : playlists.find(p => p.id === selectedPlaylistId)?.name || 'Unknown Playlist';

    const uploadFiles = useCallback(async (files: File[]) => {
        for (const file of files) {
            if (file.type.startsWith('audio/')) {
                try {
                    const response = await fetch(`/api/songs/upload/${encodeURIComponent(file.name)}`, {
                        method: 'POST',
                        body: file,
                        headers: {
                            'Content-Type': 'audio/mpeg'
                        }
                    });

                    if (response.ok) {
                        const result = await response.json();
                        onShowStatus(`Uploaded ${file.name} (${(result.size / 1024 / 1024).toFixed(2)} MB)`);
                    } else {
                        throw new Error(`Upload failed: ${response.statusText}`);
                    }
                } catch (error) {
                    onShowStatus(`Failed to upload ${file.name}: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
                }
            } else {
                onShowStatus(`Skipped ${file.name} - not an audio file`, 'error');
            }
        }
        onTracksChange();
    }, [onShowStatus, onTracksChange]);

    const deleteTrack = useCallback(async (trackId: number, trackName: string) => {
        if (!confirm(`Are you sure you want to delete "${trackName}"? This action cannot be undone.`)) {
            return;
        }

        try {
            const response = await client.api.songs[':id'].$delete({ param: { id: trackId.toString() } });

            if (response.ok) {
                onShowStatus(`Deleted ${trackName}`);
                onTracksChange();
                if (selectedPlaylistId !== null) {
                    onPlaylistTracksChange(selectedPlaylistId);
                }
            } else {
                const error = await response.json() as { error?: string };
                throw new Error(error.error || 'Delete failed');
            }
        } catch (error) {
            onShowStatus(`Failed to delete ${trackName}: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
        }
    }, [onShowStatus, onTracksChange, selectedPlaylistId, onPlaylistTracksChange]);

    const removeFromPlaylist = useCallback(async (playlistId: number, trackId: number, trackName: string) => {
        try {
            const response = await client.api.playlists[':id'].tracks[':trackId'].$delete({
                param: { id: playlistId.toString(), trackId: trackId.toString() }
            });

            if (response.ok) {
                onShowStatus(`Removed "${trackName}" from playlist`);
                onPlaylistTracksChange(playlistId);
            } else {
                const errorData = await response.json();
                throw new Error((errorData as any).error || 'Failed to remove track from playlist');
            }
        } catch (error) {
            onShowStatus(`Failed to remove track from playlist: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
        }
    }, [onShowStatus, onPlaylistTracksChange]);

    const addToPlaylist = useCallback(async (trackId: number, trackName: string) => {
        if (playlists.length === 0) {
            onShowStatus('Create a playlist first before adding tracks', 'error');
            return;
        }

        const playlistOptions = playlists.map(p => `${p.id}: ${p.name}`).join('\n');
        const choice = prompt(`Select playlist to add "${trackName}" to:\n\n${playlistOptions}\n\nEnter playlist ID:`);

        if (!choice) return;

        const playlistId = parseInt(choice);
        const playlist = playlists.find(p => p.id === playlistId);

        if (!playlist) {
            onShowStatus('Invalid playlist ID', 'error');
            return;
        }

        try {
            const response = await fetch(`/api/playlists/${playlistId}/tracks`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ trackId })
            });

            if (response.ok) {
                onShowStatus(`Track added to "${playlist.name}"`);
                onPlaylistTracksChange(playlistId);
            } else {
                const errorData = await response.json();
                throw new Error((errorData as any).error || 'Failed to add track to playlist');
            }
        } catch (error) {
            onShowStatus(`Failed to add track to playlist: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
        }
    }, [playlists, onShowStatus, onPlaylistTracksChange]);

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

    return (
        <div className="main-content">
            <div className="main-header">
                <h1>{playlistName}</h1>
                <div className="track-count">
                    {currentTracks.length} track{currentTracks.length !== 1 ? 's' : ''}
                </div>
            </div>

            {selectedPlaylistId === null && (
                <div className="upload-section">
                    <div
                        className={`upload-area ${isDragOver ? 'dragover' : ''}`}
                        onClick={handleUploadAreaClick}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                    >
                        <div className="upload-icon">📁</div>
                        <p>Drop MP3 files here or click to select</p>
                        <input
                            type="file"
                            ref={fileInputRef}
                            accept="audio/*"
                            multiple
                            onChange={handleFileInputChange}
                        />
                    </div>
                </div>
            )}

            <div className="tracks-section">
                {currentTracks.length === 0 ? (
                    <div className="empty-state">
                        {selectedPlaylistId === null 
                            ? 'No tracks uploaded yet' 
                            : 'No tracks in this playlist'}
                    </div>
                ) : (
                    <div className="tracks-list">
                        {currentTracks.map((track, index) => {
                            const listenTimeText = (track.total_seconds || 0) > 0
                                ? `Listened: ${Math.floor((track.total_seconds || 0) / 60)}m ${(track.total_seconds || 0) % 60}s • ${track.listen_count || 0} session${track.listen_count !== 1 ? 's' : ''}`
                                : 'Not played yet';

                            return (
                                <div key={track.id} className="track-item">
                                    <div className="track-index">
                                        {index + 1}
                                    </div>
                                    
                                    <div className="track-thumbnail">
                                        {track.thumbnail_path ? (
                                            <img
                                                src={`/api/songs/${track.id}/thumbnail`}
                                                alt="Album art"
                                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                            />
                                        ) : (
                                            <div className="thumbnail-placeholder">♪</div>
                                        )}
                                    </div>

                                    <div className="track-info">
                                        <div className="track-title">{track.title || track.filename}</div>
                                        <div className="track-meta">
                                            {track.artist && `${track.artist}`}
                                            {track.artist && track.album && ' • '}
                                            {track.album && `${track.album}`}
                                            {(track.artist || track.album) && track.duration && ' • '}
                                            {track.duration && `${Math.floor(track.duration / 60)}:${(track.duration % 60).toString().padStart(2, '0')}`}
                                        </div>
                                        <div className="track-stats">
                                            {(track.file_size / 1024 / 1024).toFixed(2)} MB • {listenTimeText}
                                        </div>
                                    </div>

                                    <div className="track-actions">
                                        <button 
                                            className="play-btn" 
                                            onClick={() => onTrackPlay(track.id, track.title || track.filename)}
                                        >
                                            ▶
                                        </button>
                                        
                                        {selectedPlaylistId === null ? (
                                            <>
                                                <button 
                                                    className="add-btn" 
                                                    onClick={() => addToPlaylist(track.id, track.title || track.filename)}
                                                    title="Add to playlist"
                                                >
                                                    +
                                                </button>
                                                <button 
                                                    className="delete-btn" 
                                                    onClick={() => deleteTrack(track.id, track.title || track.filename)}
                                                    title="Delete track"
                                                >
                                                    🗑
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                <button 
                                                    className="add-btn" 
                                                    onClick={() => addToPlaylist(track.id, track.title || track.filename)}
                                                    title="Add to another playlist"
                                                >
                                                    +
                                                </button>
                                                <button 
                                                    className="remove-btn" 
                                                    onClick={() => removeFromPlaylist(selectedPlaylistId, track.id, track.title || track.filename)}
                                                    title="Remove from playlist"
                                                >
                                                    −
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

export default MainContent;