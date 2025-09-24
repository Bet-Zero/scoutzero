/**
 * Purpose: Render a player headshot image with fallback.
 * Inputs: src/url (string), alt (string), size/className (string).
 * Outputs: <img> element sized to its container.
 * Risks: None known.
 * Next TODO: Confirm props/defaults; consider skeleton placeholder.
*/
import React, { useEffect, useMemo, useState } from 'react';

const DEFAULT_HEADSHOT_PATH = '/assets/headshots/default.png';

const PlayerHeadshot = ({ src, playerId, alt, className = '' }) => {
  const [currentSrc, setCurrentSrc] = useState('');

  const resolvedSrc = useMemo(() => {
    if (src && typeof src === 'string' && src.trim()) {
      return src.trim();
    }
    return playerId ? `/assets/headshots/${playerId}.png` : DEFAULT_HEADSHOT_PATH;
  }, [playerId, src]);

  const altText = useMemo(() => {
    if (alt && alt.trim()) return alt.trim();
    if (playerId) return `Player ${playerId} headshot`;
    return 'Player headshot';
  }, [alt, playerId]);

  useEffect(() => {
    setCurrentSrc('');
  }, [resolvedSrc]);

  const handleError = (event) => {
    const target = event?.currentTarget;
    if (!target || target.dataset.fallbackApplied) return;
    target.dataset.fallbackApplied = 'true';
    setCurrentSrc(DEFAULT_HEADSHOT_PATH);
  };

  return (
    <div
      className={`w-[200px] h-[200px] rounded-xl overflow-hidden border-2 border-black ${className}`}
    >
      <img
        src={currentSrc || resolvedSrc}
        onError={handleError}
        alt={altText}
        className="w-full h-full object-cover"
        loading="lazy"
        decoding="async"
      />
    </div>
  );
};

export default PlayerHeadshot;
