import React, { useEffect, useRef, useState, useCallback } from 'react';
import './AdvancedAudioPlayer.css';

interface AdvancedAudioPlayerProps {
  songId: number | null;
}

interface AudioPlayerState {
  isPlaying: boolean;
  duration: number;
  currentTime: number;
  playbackRate: number;
  volume: number;
  isLoading: boolean;
  error: string | null;
  status: string;
}

const AdvancedAudioPlayer: React.FC<AdvancedAudioPlayerProps> = ({ songId }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentSongIdRef = useRef<number | null>(null);
  const shouldAutoPlayRef = useRef<boolean>(false);

  const [state, setState] = useState<AudioPlayerState>({
    isPlaying: false,
    duration: 0,
    currentTime: 0,
    playbackRate: 1,
    volume: 100,
    isLoading: false,
    error: null,
    status: 'Ready'
  });

  const updateState = useCallback((updates: Partial<AudioPlayerState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  const formatTime = useCallback((seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  const updateProgress = useCallback(() => {
    if (audioRef.current) {
      updateState({ 
        currentTime: audioRef.current.currentTime,
        isPlaying: !audioRef.current.paused
      });
    }
  }, [updateState]);

  const loadSong = useCallback(async (id: number) => {
    // Prevent loading the same song multiple times
    if (currentSongIdRef.current === id && audioRef.current?.src) {
      shouldAutoPlayRef.current = true;
      return;
    }

    // Prevent double loading
    if (state.isLoading) return;

    currentSongIdRef.current = id;
    shouldAutoPlayRef.current = true;
    updateState({ isLoading: true, error: null, status: 'Loading audio file...' });

    try {
      if (!audioRef.current) {
        audioRef.current = new Audio();
        
        // Set up event listeners
        audioRef.current.addEventListener('loadedmetadata', () => {
          if (audioRef.current) {
            updateState({
              duration: audioRef.current.duration,
              isLoading: false,
              status: 'Audio loaded successfully',
              currentTime: 0
            });
          }
        });

        audioRef.current.addEventListener('timeupdate', updateProgress);
        audioRef.current.addEventListener('ended', () => {
          updateState({ isPlaying: false, status: 'Stopped' });
        });

        audioRef.current.addEventListener('error', () => {
          updateState({
            isLoading: false,
            error: 'Error loading audio file',
            status: 'Error loading audio file'
          });
        });
      }

      // Set source and load
      audioRef.current.src = `/api/songs/${id}/download`;
      audioRef.current.load();

    } catch (error) {
      console.error('Error loading audio:', error);
      updateState({
        isLoading: false,
        error: 'Error loading audio file',
        status: 'Error loading audio file'
      });
    }
  }, [updateState, updateProgress, state.isLoading]);

  const play = useCallback(async () => {
    if (!audioRef.current) return;
    
    try {
      await audioRef.current.play();
      updateState({ isPlaying: true, status: 'Playing' });
    } catch (error) {
      console.error('Error playing audio:', error);
      updateState({ error: 'Error playing audio', status: 'Error' });
    }
  }, [updateState]);

  const pause = useCallback(() => {
    if (!audioRef.current || audioRef.current.paused) return;

    audioRef.current.pause();
    updateState({ isPlaying: false, status: 'Paused' });
  }, [updateState]);

  const stop = useCallback(() => {
    if (!audioRef.current) return;

    audioRef.current.pause();
    audioRef.current.currentTime = 0;
    updateState({
      isPlaying: false,
      currentTime: 0,
      status: 'Stopped'
    });
  }, [updateState]);

  const seek = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const percent = (event.clientX - rect.left) / rect.width;
    const seekTime = Math.max(0, Math.min(percent * state.duration, state.duration));

    audioRef.current.currentTime = seekTime;
    updateState({ currentTime: seekTime });
  }, [state.duration, updateState]);

  const updatePlaybackRate = useCallback((newRate: number) => {
    if (audioRef.current) {
      audioRef.current.playbackRate = newRate;
      audioRef.current.preservesPitch = false;
    }
    updateState({ playbackRate: newRate });
  }, [updateState]);

  const updateVolume = useCallback((newVolume: number) => {
    if (audioRef.current) {
      audioRef.current.volume = newVolume / 100;
    }
    updateState({ volume: newVolume });
  }, [updateState]);

  // Load song when songId changes
  useEffect(() => {
    if (songId !== null) {
      loadSong(songId);
    }
  }, [songId, loadSong]);

  // Auto-play when audio is loaded and shouldAutoPlay is true
  useEffect(() => {
    if (shouldAutoPlayRef.current && !state.isLoading && audioRef.current?.src && !state.isPlaying) {
      shouldAutoPlayRef.current = false;
      setTimeout(() => {
        play();
      }, 100);
    }
  }, [state.isLoading, state.isPlaying, play]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
    };
  }, []);

  if (songId === null) {
    return (
      <div className="player">
        <h1>Advanced Audio Player</h1>
        <div className="status">No song selected</div>
      </div>
    );
  }

  return (
    <div className="player">
      <h1>Advanced Audio Player</h1>

      <div className="controls">
        <button
          onClick={play}
          disabled={state.isPlaying || state.isLoading || !audioRef.current?.src}
        >
          Play
        </button>
        <button
          onClick={pause}
          disabled={!state.isPlaying}
        >
          Pause
        </button>
        <button
          onClick={stop}
          disabled={!audioRef.current?.src || state.isLoading}
        >
          Stop
        </button>
      </div>

      <div className="progress-container">
        <div className="progress-bar" onClick={seek}>
          <div
            className="progress"
            style={{ width: `${state.duration > 0 ? (state.currentTime / state.duration) * 100 : 0}%` }}
          />
        </div>
        <div className="time-display">
          <span>{formatTime(state.currentTime)}</span>
          <span>{formatTime(state.duration)}</span>
        </div>
      </div>

      <div className="slider-container">
        <div className="slider-label">
          <span>Playback Rate</span>
          <span>{state.playbackRate.toFixed(2)}x</span>
        </div>
        <input
          type="range"
          className="slider"
          min="0.5"
          max="2"
          step="0.05"
          value={state.playbackRate}
          onChange={(e) => updatePlaybackRate(parseFloat(e.target.value))}
        />
      </div>

      <div className="slider-container">
        <div className="slider-label">
          <span>Volume</span>
          <span>{state.volume}%</span>
        </div>
        <input
          type="range"
          className="slider"
          min="0"
          max="100"
          step="1"
          value={state.volume}
          onChange={(e) => updateVolume(parseInt(e.target.value))}
        />
      </div>

      <div className="status">
        {state.isLoading && <span className="loading"></span>}
        {state.error || state.status}
      </div>
    </div>
  );
};

export default AdvancedAudioPlayer;