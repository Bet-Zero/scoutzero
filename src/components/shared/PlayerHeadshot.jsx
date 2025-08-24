import React from 'react';
import { buildHeadshotUrl, DEFAULT_HEADSHOT } from '@/utils/headshots';

const PlayerHeadshot = ({ src, playerId, className = '' }) => {
  // Use provided src or build from playerId using utility
  const initialSrc = src || buildHeadshotUrl({ id: playerId });

  const handleError = (e) => {
    if (e.currentTarget.src !== DEFAULT_HEADSHOT) {
      e.currentTarget.src = DEFAULT_HEADSHOT;
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
        loading="lazy"
        className="w-full h-full object-cover"
      />
    </div>
  );
};

export default PlayerHeadshot;
