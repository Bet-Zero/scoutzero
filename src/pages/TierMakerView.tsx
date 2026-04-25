import React, { useState, useEffect, useCallback } from 'react';
import {
  useParams,
  useSearchParams,
  useNavigate,
  Link,
} from 'react-router-dom';
import TierMakerBoard from '@/features/tierMaker/TierMakerBoard';
import TieramidBoard from '@/features/tierMaker/TieramidBoard';
import { useTierDraft } from '@/features/tierMaker/hooks/useTierDraft';
import {
  standardToTieramid,
  tieramidToStandard,
  isStandardEmpty,
  isTieramidEmpty,
} from '@/features/tierMaker/utils/draftConversion';
import { useAuth } from '@/shared/hooks/useAuth';
import { fetchTierList } from '@/firebase/listHelpers';
import { toast } from 'react-hot-toast';
import { useRef } from 'react';

type ViewMode = 'standard' | 'tieramid';

type SavedRouteState = {
  status: 'ready' | 'loading' | 'error';
  errorCode: string | null;
};

const isValidViewMode = (
  value: string | null | undefined
): value is ViewMode =>
  value === 'standard' || value === 'tieramid';

const toViewMode = (tierListMode: unknown): ViewMode =>
  tierListMode === 'pyramid' ? 'tieramid' : 'standard';

const getErrorCode = (error: unknown): string => {
  if (typeof error === 'object' && error && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === 'string') return code;
  }
  return 'unknown';
};

const TierMakerView = () => {
  const { tierListId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { userId, loading: authLoading } = useAuth();

  const isDraftMode = !tierListId;
  const urlMode = searchParams.get('mode');

  // Read mode from query param on initial render, default to 'standard'
  const initialMode = isValidViewMode(urlMode) ? urlMode : 'standard';
  const [mode, setMode] = useState<ViewMode>(initialMode);
  const [showModeToggle, setShowModeToggle] = useState(true);
  const [linkCopied, setLinkCopied] = useState(false);
  const [savedRouteState, setSavedRouteState] = useState<SavedRouteState>({
    status: isDraftMode ? 'ready' : 'loading',
    errorCode: null,
  });
  const verifiedSavedRouteRef = useRef<string | null>(null);
  const resolvedSavedModeRef = useRef<ViewMode>('standard');

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
    if (isValidViewMode(urlMode) && urlMode !== mode) {
      setMode(urlMode);
    }
  }, [urlMode, mode]);

  useEffect(() => {
    if (isDraftMode) {
      verifiedSavedRouteRef.current = null;
      resolvedSavedModeRef.current = 'standard';
      setSavedRouteState({ status: 'ready', errorCode: null });
      return;
    }

    if (authLoading) {
      setSavedRouteState({ status: 'loading', errorCode: null });
      return;
    }

    if (!tierListId) {
      setSavedRouteState({ status: 'error', errorCode: 'not-found' });
      return;
    }

    const routeKey = `${tierListId}:${userId || 'no-session'}`;
    const applyMode = (nextMode: ViewMode) => {
      if (!isValidViewMode(urlMode) || urlMode !== nextMode) {
        setSearchParams({ mode: nextMode }, { replace: true });
      }
      if (mode !== nextMode) {
        setMode(nextMode);
      }
      setSavedRouteState({ status: 'ready', errorCode: null });
    };

    if (verifiedSavedRouteRef.current === routeKey) {
      applyMode(
        isValidViewMode(urlMode) ? urlMode : resolvedSavedModeRef.current
      );
      return;
    }

    let cancelled = false;
    setSavedRouteState({ status: 'loading', errorCode: null });

    const verifySavedRoute = async () => {
      try {
        const data = await fetchTierList(tierListId, userId);
        if (cancelled) return;

        verifiedSavedRouteRef.current = routeKey;
        resolvedSavedModeRef.current = toViewMode(data?.mode);
        applyMode(
          isValidViewMode(urlMode) ? urlMode : resolvedSavedModeRef.current
        );
      } catch (error) {
        if (cancelled) return;
        verifiedSavedRouteRef.current = null;
        setSavedRouteState({
          status: 'error',
          errorCode: getErrorCode(error),
        });
      }
    };

    verifySavedRoute();

    return () => {
      cancelled = true;
    };
  }, [
    authLoading,
    isDraftMode,
    mode,
    setSearchParams,
    tierListId,
    urlMode,
    userId,
  ]);

  // Handle mode toggle — update query param and run conversion if needed
  const handleModeChange = useCallback(
    (newMode: ViewMode) => {
      // Cross-mode conversion (draft mode only)
      if (isDraftMode) {
        if (
          newMode === 'tieramid' &&
          draftStandard &&
          isTieramidEmpty(draftTieramid) &&
          !isStandardEmpty(draftStandard)
        ) {
          updateTieramid(standardToTieramid(draftStandard));
        } else if (
          newMode === 'standard' &&
          draftTieramid &&
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
    (newTierListId: string) => {
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
  const handleCopyReopenLink = useCallback(() => {
    if (!tierListId) {
      // Draft mode — disable with a toast hint
      toast('Save your tier list first to get a reopen link.', {
        icon: 'ℹ️',
      });
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

  if (!isDraftMode && (authLoading || savedRouteState.status === 'loading')) {
    return (
      <div className="bg-neutral-900 min-h-screen text-white flex items-center justify-center">
        Loading tier list...
      </div>
    );
  }

  if (!isDraftMode && savedRouteState.status === 'error') {
    const message =
      savedRouteState.errorCode === 'not-found'
        ? 'Tier list not found.'
        : savedRouteState.errorCode === 'permission-denied'
          ? "This tier list belongs to a different session and can’t be opened here."
          : savedRouteState.errorCode === 'no-session'
            ? 'Unable to initialize your session. This tier list can’t be opened right now.'
            : 'Unable to open this tier list right now.';

    return (
      <div className="bg-neutral-900 min-h-screen text-white flex items-center justify-center px-4">
        <div className="max-w-md w-full rounded-xl border border-white/10 bg-white/5 p-6 text-center">
          <h1 className="text-2xl font-semibold mb-3">Tier List Unavailable</h1>
          <p className="text-white/70 mb-6">{message}</p>
          <Link
            to="/tier-lists"
            className="inline-flex items-center justify-center rounded bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/20"
          >
            Back to Tier Lists
          </Link>
        </div>
      </div>
    );
  }

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
            onClick={handleCopyReopenLink}
            title={
              isDraftMode ? 'Save to get a reopen link' : 'Copy reopen link'
            }
          >
            {linkCopied ? '✓ Copied' : 'Copy Reopen Link'}
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
