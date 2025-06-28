import React, { useState, useCallback } from 'react';
import { client } from './api-client';
import './SideNav.css';

interface Playlist {
    id: number;
    name: string;
    created_at: string;
    updated_at: string;
}

interface SideNavProps {
    playlists: Playlist[];
    onPlaylistSelect: (playlistId: number | null) => void;
    onPlaylistsChange: () => void;
    selectedPlaylistId: number | null;
    onShowStatus: (message: string, type?: 'success' | 'error') => void;
}

const SideNav: React.FC<SideNavProps> = ({
    playlists,
    onPlaylistSelect,
    onPlaylistsChange,
    selectedPlaylistId,
    onShowStatus
}) => {
    const [playlistName, setPlaylistName] = useState('');
    const [showCreateForm, setShowCreateForm] = useState(false);

    const createPlaylist = useCallback(async () => {
        if (!playlistName.trim()) {
            onShowStatus('Please enter a playlist name', 'error');
            return;
        }

        try {
            const response = await client.api.playlists.$post({
                json: { name: playlistName.trim() }
            });

            if (response.ok) {
                setPlaylistName('');
                setShowCreateForm(false);
                onShowStatus(`Playlist "${playlistName.trim()}" created successfully`);
                onPlaylistsChange();
            } else {
                const errorData = await response.json();
                throw new Error((errorData as any).error || 'Failed to create playlist');
            }
        } catch (error) {
            onShowStatus(`Failed to create playlist: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
        }
    }, [playlistName, onShowStatus, onPlaylistsChange]);

    const deletePlaylist = useCallback(async (id: number, name: string) => {
        if (!confirm(`Are you sure you want to delete the playlist "${name}"? This action cannot be undone.`)) {
            return;
        }

        try {
            const response = await client.api.playlists[':id'].$delete({ param: { id: id.toString() } });

            if (response.ok) {
                onShowStatus('Playlist deleted successfully');
                onPlaylistsChange();
                if (selectedPlaylistId === id) {
                    onPlaylistSelect(null);
                }
            } else {
                const errorData = await response.json();
                throw new Error((errorData as any).error || 'Failed to delete playlist');
            }
        } catch (error) {
            onShowStatus(`Failed to delete playlist: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
        }
    }, [onShowStatus, onPlaylistsChange, selectedPlaylistId, onPlaylistSelect]);

    const handlePlaylistNameKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            createPlaylist();
        } else if (e.key === 'Escape') {
            setShowCreateForm(false);
            setPlaylistName('');
        }
    };

    return (
        <div className="sidenav">
            <div className="sidenav-header">
                <h2>Music Library</h2>
            </div>

            <div className="sidenav-section">
                <button
                    className={`nav-item ${selectedPlaylistId === null ? 'active' : ''}`}
                    onClick={() => onPlaylistSelect(null)}
                >
                    <span className="nav-icon">🎵</span>
                    All Songs
                </button>
            </div>

            <div className="sidenav-section">
                <div className="section-header">
                    <h3>Playlists</h3>
                    <button
                        className="add-playlist-btn"
                        onClick={() => setShowCreateForm(true)}
                        title="Create new playlist"
                    >
                        +
                    </button>
                </div>

                {showCreateForm && (
                    <div className="create-playlist-form">
                        <input
                            type="text"
                            value={playlistName}
                            onChange={(e) => setPlaylistName(e.target.value)}
                            onKeyDown={handlePlaylistNameKeyPress}
                            placeholder="Playlist name..."
                            className="playlist-input"
                            autoFocus
                        />
                        <div className="form-actions">
                            <button onClick={createPlaylist} className="create-btn">Create</button>
                            <button onClick={() => {
                                setShowCreateForm(false);
                                setPlaylistName('');
                            }} className="cancel-btn">Cancel</button>
                        </div>
                    </div>
                )}

                <div className="playlist-list">
                    {playlists.length === 0 ? (
                        <div className="empty-state">No playlists yet</div>
                    ) : (
                        playlists.map(playlist => (
                            <div key={playlist.id} className="playlist-item">
                                <button
                                    className={`nav-item ${selectedPlaylistId === playlist.id ? 'active' : ''}`}
                                    onClick={() => onPlaylistSelect(playlist.id)}
                                >
                                    <span className="nav-icon">📁</span>
                                    <span className="playlist-name">{playlist.name}</span>
                                </button>
                                <button
                                    className="delete-playlist-btn"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        deletePlaylist(playlist.id, playlist.name);
                                    }}
                                    title="Delete playlist"
                                >
                                    ×
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

export default SideNav;