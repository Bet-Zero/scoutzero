/**
 * FILE: src/features/ranker/SavedSessionsPanel.tsx
 * PURPOSE: Owner-only list (inside the workbench's Saved menu) to reopen or delete Player Ranker sessions saved to Firestore
 * OWNERSHIP: Feature: ranker
 *
 * HISTORY:
 *  - 2026-10-21: Created in the Player Ranker audit fix pass (PR #562)
 *  - 2026-10-24: Rows only; shown in the workbench toolbar's Saved menu
 *  - 2026-10-27: Counts the user's answers, not results added by lock-ins/anchor
 *
 * LINKS:
 *  - PR: https://github.com/Bet-Zero/scoutzero/pull/562
 *  - Used in: src/features/ranker/PoolSourceMenus.tsx; data: src/firebase/rankerHelpers.ts
 */
import React from 'react';
import { FolderOpen, Trash2 } from 'lucide-react';
import {
  getTimestampMillis,
  type RankerSession,
} from '@/firebase/rankerHelpers';
import { countAnswers } from './utils/rankerLocalDraft';

// Owner-only list of ranker sessions saved to Firestore
export const SavedSessionsPanel = ({
  sessions,
  loading,
  onOpen,
  onDelete,
}: {
  sessions: RankerSession[];
  loading: boolean;
  onOpen: (sessionId: string) => void;
  onDelete: (sessionId: string) => void;
}) => {
  if (loading && sessions.length === 0) {
    return <p className="px-1 py-2 text-white/40 text-sm">Loading…</p>;
  }
  if (sessions.length === 0) {
    return (
      <p className="px-1 py-2 text-white/40 text-sm">No saved rankings yet.</p>
    );
  }

  return (
    <ul className="flex flex-col gap-1">
      {sessions.map((session) => {
        const updated = getTimestampMillis(session.updatedAt);
        const answers = countAnswers(session);
        return (
          <li
            key={session.id}
            className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-white/[0.05]"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white truncate">{session.name}</p>
              <p className="text-xs text-white/40">
                {session.isFinished ? 'Finished' : 'In progress'} ·{' '}
                {session.playerPoolIds.length} players ·{' '}
                {answers} {answers === 1 ? 'answer' : 'answers'}
                {updated ? ` · ${new Date(updated).toLocaleDateString()}` : ''}
              </p>
            </div>
            <button
              onClick={() => onOpen(session.id)}
              disabled={loading}
              className="px-3 py-1.5 text-xs rounded-lg bg-white/10 hover:bg-white/20 text-white/80 disabled:opacity-50 flex items-center gap-1"
            >
              <FolderOpen className="w-3.5 h-3.5" />
              Open
            </button>
            <button
              onClick={() => {
                if (
                  window.confirm(
                    `Delete the saved session "${session.name}"? This cannot be undone.`
                  )
                ) {
                  onDelete(session.id);
                }
              }}
              disabled={loading}
              title="Delete saved session"
              aria-label="Delete saved session"
              className="p-1.5 rounded-lg text-white/40 hover:text-red-300 hover:bg-red-500/20 disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </li>
        );
      })}
    </ul>
  );
};
