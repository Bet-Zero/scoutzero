import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import TierMakerBoard from '@/features/tierMaker/TierMakerBoard';
import TieramidBoard from '@/features/tierMaker/TieramidBoard';

const TierMakerView = () => {
  const { tierListId } = useParams();
  const [mode, setMode] = useState('standard'); // 'standard' or 'tieramid'
  const [showModeToggle, setShowModeToggle] = useState(true);

  return (
    <div className="bg-neutral-900 min-h-screen text-white pt-4 pb-8">
      {showModeToggle && (
      <div className="flex justify-center gap-2 mb-3">
        <button
          className={`h-8 px-3 rounded text-sm transition-all ${
            mode === 'standard'
              ? 'bg-white/15 text-white'
              : 'bg-white/5 text-white/80 hover:bg-white/10'
          }`}
          onClick={() => setMode('standard')}
        >
          Tiermaker
        </button>
        <button
          className={`h-8 px-3 rounded text-sm transition-all ${
            mode === 'tieramid'
              ? 'bg-white/15 text-white'
              : 'bg-white/5 text-white/80 hover:bg-white/10'
          }`}
          onClick={() => setMode('tieramid')}
        >
          Tieramid
        </button>
      </div>
      )}
      {mode === 'standard' ? (
        <TierMakerBoard initialTierListId={tierListId} />
      ) : (
        <TieramidBoard onScreenshotChange={(isOn) => setShowModeToggle(!isOn)} />
      )}
    </div>
  );
};

export default TierMakerView;
