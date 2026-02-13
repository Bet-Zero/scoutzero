import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import TierMakerBoard from '@/features/tierMaker/TierMakerBoard';
import TieramidBoard from '@/features/tierMaker/TieramidBoard';
import { useTierDraft } from '@/features/tierMaker/hooks/useTierDraft';
import {
  standardToTieramid,
  tieramidToStandard,
  isStandardEmpty,
  isTieramidEmpty,
} from '@/features/tierMaker/utils/draftConversion';
import { toast } from 'react-hot-toast';

const TierMakerView = () => {
  const { tierListId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const isDraftMode = !tierListId;

  // Read mode from query param on initial render, default to 'standard'
  const initialMode = searchParams.get('mode') || 'standard';
  const [mode, setMode] = useState(initialMode);
  const [showModeToggle, setShowModeToggle] = useState(true);
  const [linkCopied, setLinkCopied] = useState(false);

  // Draft state management (inert when isDraftMode is false)
  const {
    draftStandard,
    draftTieramid,
    updateStandard,
    updateTieramid,
    clearDraft,
    restored,
  } = useTierDraft(isDraftMode);

  // Sync mode state with query param on initial load and when URL changes
  useEffect(() => {
    const urlMode = searchParams.get('mode');
    if (urlMode && urlMode !== mode) {
      setMode(urlMode);
    }
  }, [searchParams, mode]);

  // Handle mode toggle — update query param and run conversion if needed
  const handleModeChange = useCallback(
    (newMode) => {
      // Cross-mode conversion (draft mode only)
      if (isDraftMode) {
        if (
          newMode === 'tieramid' &&
          isTieramidEmpty(draftTieramid) &&
          !isStandardEmpty(draftStandard)
        ) {
          updateTieramid(standardToTieramid(draftStandard));
        } else if (
          newMode === 'standard' &&
          isStandardEmpty(draftStandard) &&
          !isTieramidEmpty(draftTieramid)
        ) {
          updateStandard(tieramidToStandard(draftTieramid));
        }
      }

      setMode(newMode);
      setSearchParams({ mode: newMode }, { replace: true });
    },
    [
      setSearchParams,
      isDraftMode,
      draftStandard,
      draftTieramid,
      updateStandard,
      updateTieramid,
    ]
  );

  // Callback for child boards to update URL when a tier list is loaded/created
  const handleTierListChange = useCallback(
    (newTierListId) => {
      if (newTierListId) {
        // Clear draft on successful save (user chose to persist to Firestore)
        if (isDraftMode) {
          clearDraft();
        }
        navigate(`/tier-maker/${newTierListId}?mode=${mode}`, {
          replace: true,
        });
      }
    },
    [navigate, mode, isDraftMode, clearDraft]
  );

  // ── Share Link handler ──
  const handleCopyShareLink = useCallback(() => {
    if (!tierListId) {
      // Draft mode — disable with a toast hint
      toast('Save your tier list first to get a share link.', { icon: 'ℹ️' });
      return;
    }
    const url = `${window.location.origin}/tier-maker/${tierListId}?mode=${mode}`;
    navigator.clipboard
      .writeText(url)
      .then(() => {
        setLinkCopied(true);
        toast.success('Link copied!');
        setTimeout(() => setLinkCopied(false), 2000);
      })
      .catch(() => {
        toast.error('Failed to copy link');
      });
  }, [tierListId, mode]);

  // Determine if there is any draft content for the Clear Draft button
  const hasDraftContent =
    isDraftMode &&
    (!isStandardEmpty(draftStandard) || !isTieramidEmpty(draftTieramid));

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
          {hasDraftContent && (
            <button
              className="h-8 px-3 rounded text-sm transition-all bg-red-900/40 text-red-300 hover:bg-red-800/60"
              onClick={clearDraft}
            >
              Clear Draft
            </button>
          )}
          <button
            className={`h-8 px-3 rounded text-sm transition-all ${
              linkCopied
                ? 'bg-green-700/40 text-green-300'
                : isDraftMode
                  ? 'bg-white/5 text-white/40 cursor-not-allowed'
                  : 'bg-white/5 text-white/80 hover:bg-white/10'
            }`}
            onClick={handleCopyShareLink}
            title={isDraftMode ? 'Save to get a share link' : 'Copy share link'}
          >
            {linkCopied ? '✓ Copied' : '🔗 Share'}
          </button>
        </div>
      )}
      {mode === 'standard' ? (
        <TierMakerBoard
          initialTierListId={tierListId}
          onTierListChange={handleTierListChange}
          onScreenshotChange={(isOn) => setShowModeToggle(!isOn)}
          isDraftMode={isDraftMode}
          draftData={draftStandard}
          onDraftChange={updateStandard}
          draftRestored={restored}
        />
      ) : (
        <TieramidBoard
          initialTierListId={tierListId}
          onTierListChange={handleTierListChange}
          onScreenshotChange={(isOn) => setShowModeToggle(!isOn)}
          isDraftMode={isDraftMode}
          draftData={draftTieramid}
          onDraftChange={updateTieramid}
          draftRestored={restored}
        />
      )}
    </div>
  );
};

export default TierMakerView;
