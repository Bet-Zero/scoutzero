import React from 'react';
import { normalizePlayerId } from '@/utils/formatting';

const PlayerHeadshot = ({ src, playerId, className = '' }) => {
  const initialSrc = src || `/assets/headshots/${playerId}.png`;

  const handleError = (e) => {
    if (!playerId) {
      e.target.src = '/assets/headshots/default.png';
      return;
    }
    const fallback = `/assets/headshots/${normalizePlayerId(playerId)}.png`;
    if (!e.target.dataset.fallback && fallback !== initialSrc) {
      e.target.dataset.fallback = 'tried';
      e.target.src = fallback;
    } else {
      e.target.src = '/assets/headshots/default.png';
    }
  };

  return (
    <div
      className={`w-[200px] h-[200px] rounded-xl overflow-hidden border-2 border-black ${className}`}
    >
      <img
        src={initialSrc}
        onError={handleError}
        alt="Player headshot"
        className="w-full h-full object-cover"
      />
    </div>
  );
};

export default PlayerHeadshot;
