import React from 'react';
import AdvancedAudioPlayer from './AdvancedAudioPlayer';
import './Player.css';

interface PlayerProps {
  currentTrackId: number | null;
  currentTrackName?: string;
}

const Player: React.FC<PlayerProps> = ({ currentTrackId, currentTrackName }) => {
  if (currentTrackId === null) {
    return (
      <div className="player-container">
        <div className="player-empty">
          <div className="player-empty-icon">🎵</div>
          <div className="player-empty-text">No track selected</div>
        </div>
      </div>
    );
  }

  return (
    <div className="player-container">
      <div className="player-header">
        <div className="now-playing">
          <span className="now-playing-label">Now Playing:</span>
          <span className="now-playing-track">{currentTrackName || `Track ${currentTrackId}`}</span>
        </div>
      </div>
      <div className="player-content">
        <AdvancedAudioPlayer songId={currentTrackId} />
      </div>
    </div>
  );
};

export default Player;