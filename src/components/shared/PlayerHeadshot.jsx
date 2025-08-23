import React from 'react';

const PlayerHeadshot = ({ src, playerId, className = '' }) => {
  const initialSrc =
    src ||
    `https://ofbebc3ljlmaq3bj.public.blob.vercel-storage.com/headshots/${playerId}.png`;

  const handleError = (e) => {
    if (!playerId) {
      e.target.src =
        'https://ofbebc3ljlmaq3bj.public.blob.vercel-storage.com/headshots/default.png';
      return;
    }
    e.target.src =
      'https://ofbebc3ljlmaq3bj.public.blob.vercel-storage.com/headshots/default.png';
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
