/**
 * FILE: src/features/ranker/SaveSessionButton.tsx
 * PURPOSE: Owner-only button that saves a Player Ranker session to Firestore
 * OWNERSHIP: Feature: ranker
 *
 * HISTORY:
 *  - 2026-10-21: Created in the Player Ranker audit fix pass (PR #562)
 *  - 2026-10-26: Compact "Save progress" variant for unfinished rankings
 *
 * LINKS:
 *  - PR: https://github.com/Bet-Zero/scoutzero/pull/562
 *  - Used in: src/features/ranker/RankingSession.tsx
 */
import React from 'react';
import { Save, CheckCircle, AlertCircle } from 'lucide-react';

type SaveStatus = 'saving' | 'saved' | 'error' | null;

// Compact version for an unfinished ranking, beside "Back to pool"
const ProgressButton = ({
  onSave,
  saveStatus,
}: {
  onSave: () => void;
  saveStatus: SaveStatus;
}) => (
  <button
    onClick={onSave}
    disabled={saveStatus === 'saving'}
    className={`h-8 px-3 rounded-lg text-xs font-medium flex items-center gap-1.5 border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
      saveStatus === 'saved'
        ? 'bg-green-500/15 text-green-300 border-green-500/30'
        : saveStatus === 'error'
          ? 'bg-red-500/15 text-red-300 border-red-500/30'
          : 'text-blue-300 border-blue-500/30 hover:bg-blue-500/15'
    }`}
  >
    {saveStatus === 'saved' ? (
      <CheckCircle className="w-3.5 h-3.5" />
    ) : saveStatus === 'error' ? (
      <AlertCircle className="w-3.5 h-3.5" />
    ) : (
      <Save className="w-3.5 h-3.5" />
    )}
    {saveStatus === 'saving'
      ? 'Saving…'
      : saveStatus === 'saved'
        ? 'Progress saved'
        : saveStatus === 'error'
          ? 'Save failed (retry)'
          : 'Save progress'}
  </button>
);

// Owner-only button that saves the whole ranker session to Firestore
export const SaveSessionButton = ({
  onSave,
  saveStatus,
  compact = false,
}: {
  onSave: () => void;
  saveStatus: SaveStatus;
  compact?: boolean;
}) => compact ? (
  <ProgressButton onSave={onSave} saveStatus={saveStatus} />
) : (
  <div className="flex justify-center mt-6 mb-4">
    <button
      onClick={onSave}
      disabled={saveStatus === 'saving'}
      className={`
        px-6 py-3 rounded-xl font-medium text-sm flex items-center gap-2 transition-all
        ${
          saveStatus === 'saved'
            ? 'bg-green-500/20 text-green-400 border border-green-500/30'
            : saveStatus === 'error'
              ? 'bg-red-500/20 text-red-400 border border-red-500/30'
              : 'bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 border border-blue-500/30'
        }
        disabled:opacity-50 disabled:cursor-not-allowed
      `}
    >
      {saveStatus === 'saving' ? (
        <>
          <div className="w-4 h-4 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />
          Saving...
        </>
      ) : saveStatus === 'saved' ? (
        <>
          <CheckCircle className="w-4 h-4" />
          Saved to Firestore
        </>
      ) : saveStatus === 'error' ? (
        <>
          <AlertCircle className="w-4 h-4" />
          Save Failed (Retry)
        </>
      ) : (
        <>
          <Save className="w-4 h-4" />
          Save to Firestore
        </>
      )}
    </button>
  </div>
);
