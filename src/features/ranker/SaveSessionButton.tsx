import React from 'react';
import { Save, CheckCircle, AlertCircle } from 'lucide-react';

type SaveStatus = 'saving' | 'saved' | 'error' | null;

// Owner-only button that saves the whole ranker session to Firestore
export const SaveSessionButton = ({
  onSave,
  saveStatus,
}: {
  onSave: () => void;
  saveStatus: SaveStatus;
}) => (
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
