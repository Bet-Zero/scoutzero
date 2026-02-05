import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import TierMakerBoard from '@/features/tierMaker/TierMakerBoard';
import TieramidBoard from '@/features/tierMaker/TieramidBoard';

const TierMakerView = () => {
  const { tierListId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // Read mode from query param on initial render, default to 'standard'
  const initialMode = searchParams.get('mode') || 'standard';
  const [mode, setMode] = useState(initialMode);
  const [showModeToggle, setShowModeToggle] = useState(true);

  // Sync mode state with query param on initial load and when URL changes
  useEffect(() => {
    const urlMode = searchParams.get('mode');
    if (urlMode && urlMode !== mode) {
      setMode(urlMode);
    }
  }, [searchParams, mode]);

  // Handle mode toggle - update query param without losing tierListId
  const handleModeChange = useCallback(
    (newMode) => {
      setMode(newMode);
      // Update the query param
      setSearchParams({ mode: newMode }, { replace: true });
    },
    [setSearchParams]
  );

  // Callback for child boards to update URL when a tier list is loaded/created
  const handleTierListChange = useCallback(
    (newTierListId) => {
      if (newTierListId) {
        // Navigate to the new URL with the tierListId and preserve mode
        navigate(`/tier-maker/${newTierListId}?mode=${mode}`, {
          replace: true,
        });
      }
    },
    [navigate, mode]
  );

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
            onClick={() => handleModeChange('standard')}
          >
            Tiermaker
          </button>
          <button
            className={`h-8 px-3 rounded text-sm transition-all ${
              mode === 'tieramid'
                ? 'bg-white/15 text-white'
                : 'bg-white/5 text-white/80 hover:bg-white/10'
            }`}
            onClick={() => handleModeChange('tieramid')}
          >
            Tieramid
          </button>
        </div>
      )}
      {mode === 'standard' ? (
        <TierMakerBoard
          initialTierListId={tierListId}
          onTierListChange={handleTierListChange}
        />
      ) : (
        <TieramidBoard
          initialTierListId={tierListId}
          onTierListChange={handleTierListChange}
          onScreenshotChange={(isOn) => setShowModeToggle(!isOn)}
        />
      )}
    </div>
  );
};

export default TierMakerView;
