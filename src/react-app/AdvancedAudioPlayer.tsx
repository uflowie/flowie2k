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
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const startedAtRef = useRef<number>(0);
  const pausedAtRef = useRef<number>(0);
  const animationFrameRef = useRef<number | null>(null);
  const currentSongIdRef = useRef<number | null>(null);
  const shouldAutoPlayRef = useRef<boolean>(false);
  const isPlayingRef = useRef<boolean>(false);
  const seekPositionRef = useRef<number | null>(null);

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

  const getCurrentPosition = useCallback((): number => {
    // If we just seeked, return the seek position
    if (seekPositionRef.current !== null) {
      return seekPositionRef.current;
    }

    if (!isPlayingRef.current || !audioContextRef.current) {
      return pausedAtRef.current;
    }

    const elapsed = audioContextRef.current.currentTime - startedAtRef.current;
    return Math.min(pausedAtRef.current + elapsed * state.playbackRate, state.duration);
  }, [state.playbackRate, state.duration]);

  const updateProgress = useCallback(() => {
    if (!isPlayingRef.current) return;

    const currentPosition = getCurrentPosition();
    updateState({ currentTime: currentPosition });

    if (currentPosition < state.duration) {
      animationFrameRef.current = requestAnimationFrame(updateProgress);
    }
  }, [state.duration, getCurrentPosition, updateState]);

  const loadSong = useCallback(async (id: number) => {
    // Prevent loading the same song multiple times
    if (currentSongIdRef.current === id && audioBufferRef.current) {
      // Song already loaded, just set the auto-play flag
      shouldAutoPlayRef.current = true;
      return;
    }

    // Prevent double loading
    if (state.isLoading) return;

    currentSongIdRef.current = id;
    shouldAutoPlayRef.current = true;
    updateState({ isLoading: true, error: null, status: 'Loading audio file...' });
    stop();

    try {
      // Initialize audio context if needed
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }

      // Fetch audio file from API
      const response = await fetch(`/api/songs/${id}/download`);

      if (!response.ok) {
        throw new Error('Failed to load audio file');
      }

      // Get audio data as array buffer
      const arrayBuffer = await response.arrayBuffer();

      // Decode audio data
      const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);
      audioBufferRef.current = audioBuffer;

      updateState({
        duration: audioBuffer.duration,
        isLoading: false,
        status: 'Audio loaded successfully',
        currentTime: 0
      });

      pausedAtRef.current = 0;
      startedAtRef.current = 0;


    } catch (error) {
      console.error('Error loading audio:', error);
      updateState({
        isLoading: false,
        error: 'Error loading audio file',
        status: 'Error loading audio file'
      });
    }
  }, [updateState, state.isLoading]);

  const play = useCallback(() => {
    if (!audioBufferRef.current || !audioContextRef.current) return;
    
    // Stop any existing playback before starting new one
    if (sourceNodeRef.current) {
      sourceNodeRef.current.onended = null;
      sourceNodeRef.current.stop();
      sourceNodeRef.current.disconnect();
      sourceNodeRef.current = null;
    }
    if (gainNodeRef.current) {
      gainNodeRef.current.disconnect();
      gainNodeRef.current = null;
    }

    // Create new source node
    const sourceNode = audioContextRef.current.createBufferSource();
    sourceNode.buffer = audioBufferRef.current;
    sourceNode.playbackRate.value = state.playbackRate;

    // Create gain node for volume control
    const gainNode = audioContextRef.current.createGain();
    gainNode.gain.value = state.volume / 100;

    // Connect nodes
    sourceNode.connect(gainNode);
    gainNode.connect(audioContextRef.current.destination);

    // Set up ended event
    sourceNode.onended = () => {
      if (state.isPlaying) {
        stop();
      }
    };

    // Start playback from pausedAt position
    sourceNode.start(0, pausedAtRef.current);
    startedAtRef.current = audioContextRef.current.currentTime;

    sourceNodeRef.current = sourceNode;
    gainNodeRef.current = gainNode;

    isPlayingRef.current = true;
    updateState({ isPlaying: true, status: 'Playing' });
    
    // Start progress updates
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    updateProgress();
  }, [state.playbackRate, state.volume, updateState, updateProgress]);

  const pause = useCallback(() => {
    if (!state.isPlaying || !audioContextRef.current) return;

    // Calculate how far we've played
    const elapsed = audioContextRef.current.currentTime - startedAtRef.current;
    pausedAtRef.current = pausedAtRef.current + elapsed * state.playbackRate;

    // Make sure we don't go past the end
    pausedAtRef.current = Math.min(pausedAtRef.current, state.duration);

    // Stop the source
    if (sourceNodeRef.current) {
      sourceNodeRef.current.onended = null;
      sourceNodeRef.current.stop();
      sourceNodeRef.current.disconnect();
      sourceNodeRef.current = null;
    }

    if (gainNodeRef.current) {
      gainNodeRef.current.disconnect();
      gainNodeRef.current = null;
    }

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    isPlayingRef.current = false;
    updateState({
      isPlaying: false,
      status: 'Paused',
      currentTime: pausedAtRef.current
    });
  }, [state.isPlaying, state.playbackRate, state.duration, updateState]);

  const stop = useCallback(() => {
    if (sourceNodeRef.current) {
      sourceNodeRef.current.onended = null;
      sourceNodeRef.current.stop();
      sourceNodeRef.current.disconnect();
      sourceNodeRef.current = null;
    }

    if (gainNodeRef.current) {
      gainNodeRef.current.disconnect();
      gainNodeRef.current = null;
    }

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    pausedAtRef.current = 0;
    startedAtRef.current = 0;

    isPlayingRef.current = false;
    updateState({
      isPlaying: false,
      currentTime: 0,
      status: 'Stopped'
    });
  }, [updateState]);

  const seek = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (!audioBufferRef.current) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const percent = (event.clientX - rect.left) / rect.width;
    const seekTime = Math.max(0, Math.min(percent * state.duration, state.duration));

    const wasPlaying = state.isPlaying;

    // Stop current playback
    if (state.isPlaying) {
      if (sourceNodeRef.current) {
        sourceNodeRef.current.onended = null;
        sourceNodeRef.current.stop();
        sourceNodeRef.current.disconnect();
        sourceNodeRef.current = null;
      }
      if (gainNodeRef.current) {
        gainNodeRef.current.disconnect();
        gainNodeRef.current = null;
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    }

    // Set new position
    pausedAtRef.current = seekTime;
    seekPositionRef.current = seekTime;
    
    // Update visual position immediately
    updateState({
      currentTime: seekTime
    });

    // Clear seek position after a brief moment
    setTimeout(() => {
      seekPositionRef.current = null;
    }, 100);

    // Restart if was playing
    if (wasPlaying) {
      setTimeout(() => {
        play();
      }, 50);
    }
  }, [state.duration, state.isPlaying, play, updateState, updateProgress]);

  const updatePlaybackRate = useCallback((newRate: number) => {
    if (state.isPlaying && sourceNodeRef.current && audioContextRef.current) {
      // Calculate current position before changing rate
      const currentPosition = getCurrentPosition();

      // Update the rate
      sourceNodeRef.current.playbackRate.value = newRate;

      // Reset timing reference point
      pausedAtRef.current = currentPosition;
      startedAtRef.current = audioContextRef.current.currentTime;
    }

    updateState({ playbackRate: newRate });
  }, [state.isPlaying, getCurrentPosition, updateState]);

  const updateVolume = useCallback((newVolume: number) => {
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = newVolume / 100;
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
    if (shouldAutoPlayRef.current && !state.isLoading && audioBufferRef.current && !state.isPlaying) {
      shouldAutoPlayRef.current = false;
      setTimeout(() => {
        play();
      }, 100);
    }
  }, [state.isLoading, state.isPlaying, play]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      stop();
    };
  }, [stop]);

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
          disabled={state.isPlaying || state.isLoading || !audioBufferRef.current}
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
          disabled={!audioBufferRef.current || state.isLoading}
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