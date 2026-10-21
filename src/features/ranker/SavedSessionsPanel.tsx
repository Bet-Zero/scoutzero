import React from 'react';
import { FolderOpen, Trash2 } from 'lucide-react';
import { getTimestampMillis, type RankerSession } from '@/firebase/rankerHelpers';

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
  if (!loading && sessions.length === 0) return null;

  return (
    <div className="p-5 rounded-xl bg-white/[0.03] border border-white/[0.07] mb-5">
      <span className="text-[10px] font-bold tracking-[0.12em] uppercase text-white/35 block mb-3">
        Saved Sessions
      </span>
      {loading && sessions.length === 0 ? (
        <p className="text-white/30 text-sm">Loading…</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {sessions.map((session) => {
            const updated = getTimestampMillis(session.updatedAt);
            return (
              <li
                key={session.id}
                className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white/[0.04]"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{session.name}</p>
                  <p className="text-xs text-white/40">
                    {session.isFinished ? 'Finished' : 'In progress'} ·{' '}
                    {session.playerPoolIds.length} players ·{' '}
                    {session.results.length} comparisons
                    {updated
                      ? ` · ${new Date(updated).toLocaleDateString()}`
                      : ''}
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
      )}
    </div>
  );
};
