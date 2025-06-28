import React, { useState, useEffect, useCallback } from 'react';
import SideNav from './SideNav';
import MainContent from './MainContent';
import Player from './Player';
import { client } from './api-client';
import './MusicApp.css';

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

type StatusType = 'success' | 'error';

const MusicApp: React.FC = () => {
    const [tracks, setTracks] = useState<Track[]>([]);
    const [playlists, setPlaylists] = useState<Playlist[]>([]);
    const [playlistTracks, setPlaylistTracks] = useState<{ [key: number]: PlaylistTrack[] }>({});
    const [selectedPlaylistId, setSelectedPlaylistId] = useState<number | null>(null);
    const [currentTrackId, setCurrentTrackId] = useState<number | null>(null);
    const [currentTrackName, setCurrentTrackName] = useState<string | undefined>(undefined);
    const [status, setStatus] = useState<{ message: string; type: StatusType } | null>(null);

    const showStatus = useCallback((message: string, type: StatusType = 'success') => {
        setStatus({ message, type });
        setTimeout(() => setStatus(null), 3000);
    }, []);

    const loadTracks = useCallback(async () => {
        try {
            const response = await client.api.songs.$get();
            if (response.ok) {
                const data = await response.json();
                setTracks(data.songs || []);
            } else {
                throw new Error('Failed to fetch songs');
            }
        } catch (error) {
            showStatus(`Failed to load tracks: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
        }
    }, [showStatus]);

    const loadPlaylists = useCallback(async () => {
        try {
            const response = await client.api.playlists.$get();
            if (response.ok) {
                const data = await response.json();
                setPlaylists(data.playlists || []);
            } else {
                throw new Error('Failed to fetch playlists');
            }
        } catch (error) {
            showStatus(`Failed to load playlists: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
        }
    }, [showStatus]);

    const loadPlaylistTracks = useCallback(async (playlistId: number) => {
        try {
            const response = await client.api.playlists[':id'].tracks.$get({ param: { id: playlistId.toString() } });
            if (response.ok) {
                const data = await response.json();
                setPlaylistTracks(prev => ({ ...prev, [playlistId]: data.tracks || [] }));
            } else {
                throw new Error('Failed to fetch playlist tracks');
            }
        } catch (error) {
            showStatus(`Failed to load playlist tracks: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
        }
    }, [showStatus]);

    const handlePlaylistSelect = useCallback((playlistId: number | null) => {
        setSelectedPlaylistId(playlistId);
        if (playlistId !== null && !playlistTracks[playlistId]) {
            loadPlaylistTracks(playlistId);
        }
    }, [playlistTracks, loadPlaylistTracks]);

    const handleTrackPlay = useCallback((trackId: number, trackName: string) => {
        setCurrentTrackId(trackId);
        setCurrentTrackName(trackName);
        showStatus(`Playing: ${trackName}`);
    }, [showStatus]);

    const handlePlaylistTracksChange = useCallback((playlistId: number) => {
        loadPlaylistTracks(playlistId);
    }, [loadPlaylistTracks]);

    useEffect(() => {
        loadTracks();
        loadPlaylists();
    }, [loadTracks, loadPlaylists]);

    return (
        <div className="music-app">
            {status && (
                <div className={`status-bar ${status.type}`}>
                    {status.message}
                </div>
            )}
            
            <div className="app-layout">
                <SideNav
                    playlists={playlists}
                    onPlaylistSelect={handlePlaylistSelect}
                    onPlaylistsChange={loadPlaylists}
                    selectedPlaylistId={selectedPlaylistId}
                    onShowStatus={showStatus}
                />
                
                <MainContent
                    selectedPlaylistId={selectedPlaylistId}
                    tracks={tracks}
                    playlistTracks={playlistTracks}
                    playlists={playlists}
                    onTrackPlay={handleTrackPlay}
                    onTracksChange={loadTracks}
                    onPlaylistTracksChange={handlePlaylistTracksChange}
                    onShowStatus={showStatus}
                />
            </div>
            
            <Player
                currentTrackId={currentTrackId}
                currentTrackName={currentTrackName}
            />
        </div>
    );
};

export default MusicApp;