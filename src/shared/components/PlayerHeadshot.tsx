/**
 * Purpose: Render a player headshot image with fallback.
 * Inputs: src/url (string), alt (string), size/className (string).
 * Outputs: <img> element sized to its container.
 * Risks: Alt text may be generic; no loading state; unknown error handling.
 * Next TODO: Confirm props/defaults; add descriptive alt/ARIA; consider skeleton.
 */
import type { SyntheticEvent } from 'react';

export type PlayerHeadshotProps = {
  src?: string | null;
  playerId?: string | number | null;
  className?: string;
  /** Square edge length in pixels. Defaults to the profile-sized 200px. */
  size?: number;
};

export const PlayerHeadshot = ({
  src,
  playerId,
  className = '',
  size = 200,
}: PlayerHeadshotProps) => {
  const initialSrc = src || `/assets/headshots/${playerId}.png`;

  const handleError = (e: SyntheticEvent<HTMLImageElement>) => {
    if (!playerId) {
      e.currentTarget.src = '/assets/headshots/default.png';
      return;
    }
    e.currentTarget.src = '/assets/headshots/default.png';
  };

  return (
    <div
      style={{ width: size, height: size }}
      className={`rounded-xl overflow-hidden border-2 border-black ${className}`}
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

