import { useEffect, useMemo, useState } from 'react';
import { Loader2, Search, UserPlus, X } from 'lucide-react';
import type { FreeAgentSurfaceEntry } from '@/features/architect/freeAgency/FreeAgentPool/types';

type FullCapFreeAgentModalProps = {
  isOpen: boolean;
  onClose: () => void;
  teamLabel: string;
  seasonLabel: string;
  entries?: FreeAgentSurfaceEntry[];
  initialSelectionKey?: string | null;
  isLoading?: boolean;
  onLaunchAction?: (entry: FreeAgentSurfaceEntry) => void;
};

const getPlayerName = (entry: FreeAgentSurfaceEntry) =>
  entry.surfacePlayer.displayName ||
  entry.surfacePlayer.name ||
  entry.freeAgent.displayName ||
  entry.freeAgent.name ||
  'Free Agent';

const getPlayerMeta = (entry: FreeAgentSurfaceEntry) =>
  [
    entry.surfacePlayer.formattedPosition || entry.surfacePlayer.bio?.position,
    entry.surfacePlayer.age ? `Age ${entry.surfacePlayer.age}` : null,
    entry.surfacePlayer.teamCode ? `Last: ${entry.surfacePlayer.teamCode}` : null,
  ]
    .filter(Boolean)
    .join(' / ');

const getSearchText = (entry: FreeAgentSurfaceEntry) =>
  [
    getPlayerName(entry),
    getPlayerMeta(entry),
    entry.freeAgent.freeAgentType,
    entry.freeAgent.fa_type,
    entry.freeAgent.birdRights,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

const formatSalary = (value: unknown) => {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0
    ? `$${amount.toLocaleString()}`
    : 'Salary TBD';
};

const FullCapFreeAgentModal = ({
  isOpen,
  onClose,
  teamLabel,
  seasonLabel,
  entries = [],
  initialSelectionKey = null,
  isLoading = false,
  onLaunchAction = undefined,
}: FullCapFreeAgentModalProps) => {
  const [query, setQuery] = useState('');
  const [selectedSelectionKey, setSelectedSelectionKey] = useState<string | null>(
    null
  );

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) return;
    setQuery('');
    setSelectedSelectionKey(null);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !initialSelectionKey) return;
    if (entries.some((entry) => entry.selectionKey === initialSelectionKey)) {
      setSelectedSelectionKey(initialSelectionKey);
    }
  }, [entries, initialSelectionKey, isOpen]);

  useEffect(() => {
    if (
      selectedSelectionKey &&
      !entries.some((entry) => entry.selectionKey === selectedSelectionKey)
    ) {
      setSelectedSelectionKey(null);
    }
  }, [entries, selectedSelectionKey]);

  const hasEntries = entries.length > 0;
  const normalizedQuery = query.trim().toLowerCase();
  const filteredEntries = useMemo(
    () =>
      normalizedQuery
        ? entries.filter((entry) => getSearchText(entry).includes(normalizedQuery))
        : entries,
    [entries, normalizedQuery]
  );
  const selectedEntry =
    entries.find((entry) => entry.selectionKey === selectedSelectionKey) ?? null;

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="full-cap-free-agent-modal-title"
      data-testid="full-cap-free-agent-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 text-cockpit-text-primary backdrop-blur-sm sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-cockpit-edge bg-cockpit-slab shadow-2xl shadow-black/60">
        <header className="flex items-start justify-between gap-4 border-b border-cockpit-edge bg-cockpit-bar px-4 py-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cockpit-text-muted">
              {teamLabel} / {seasonLabel}
            </p>
            <h2 id="full-cap-free-agent-modal-title" className="mt-1 text-base font-bold text-cockpit-text-primary">
              Sign Free Agent
              <span
                aria-hidden="true"
                className="ml-2 rounded border border-cockpit-watch/30 bg-cockpit-watch/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-cockpit-watch"
              >
                Preview only
              </span>
            </h2>
            <p className="mt-1 text-xs text-cockpit-text-muted">
              {entries.length} eligible {entries.length === 1 ? 'player' : 'players'}.
              Standard free-agent signing is visible as a preview, not a V1
              supported promise.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Sign Free Agent modal"
            title="Close"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-cockpit-edge bg-cockpit-inlay text-cockpit-text-secondary transition-colors hover:bg-cockpit-raised hover:text-cockpit-text-primary focus:outline-none focus-visible:ring-1 focus-visible:ring-white/40"
          >
            <X aria-hidden className="h-4 w-4" />
          </button>
        </header>

        <div className="grid min-h-0 flex-1 gap-3 overflow-y-auto p-4 md:grid-cols-[minmax(0,1fr)_220px]">
          <section
            aria-label="Generated or current free-agent pool"
            className="min-w-0 rounded-lg border border-cockpit-edge bg-cockpit-inlay"
          >
            <div className="border-b border-cockpit-edge px-3 py-2">
              <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-cockpit-text-secondary">
                Generated / Current Pool
              </h3>
              {hasEntries && !isLoading ? (
                <label className="mt-2 flex h-9 items-center gap-2 rounded-md border border-cockpit-edge bg-cockpit-slab px-2 text-xs text-cockpit-text-secondary focus-within:ring-1 focus-within:ring-white/35">
                  <Search aria-hidden className="h-3.5 w-3.5" />
                  <span className="sr-only">Search free agents</span>
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search pool"
                    className="min-w-0 flex-1 bg-transparent text-cockpit-text-primary outline-none placeholder:text-cockpit-text-muted"
                  />
                </label>
              ) : null}
            </div>

            {isLoading ? (
              <div
                role="status"
                data-testid="full-cap-free-agent-modal-loading"
                className="flex min-h-36 items-center justify-center gap-2 px-4 py-8 text-sm text-cockpit-text-secondary"
              >
                <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
                Loading pool
              </div>
            ) : hasEntries ? (
              <ul
                data-testid="full-cap-free-agent-modal-pool"
                className="divide-y divide-cockpit-edge"
              >
                {filteredEntries.length === 0 ? (
                  <li className="px-4 py-8 text-center text-sm text-cockpit-text-secondary">
                    No matches
                  </li>
                ) : null}
                {filteredEntries.map((entry) => {
                  const isSelected = entry.selectionKey === selectedSelectionKey;
                  return (
                    <li
                      key={entry.selectionKey}
                      className={`grid gap-3 px-3 py-2.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center ${
                        isSelected ? 'bg-cockpit-raised' : ''
                      }`}
                    >
                      <button
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => setSelectedSelectionKey(entry.selectionKey)}
                        className="min-w-0 text-left focus:outline-none focus-visible:ring-1 focus-visible:ring-white/40"
                      >
                        <p className="truncate text-sm font-semibold text-cockpit-text-primary">
                          {getPlayerName(entry)}
                        </p>
                        <p className="mt-0.5 truncate text-[11px] text-cockpit-text-muted">
                          {getPlayerMeta(entry) || 'Free agent'}
                        </p>
                      </button>
                      <div className="flex items-center gap-2 sm:justify-end">
                        <span className="font-mono text-xs tabular-nums text-cockpit-text-secondary">
                          {formatSalary(
                            entry.surfacePlayer.askingSalary ??
                              entry.surfacePlayer.previousSalary
                          )}
                        </span>
                        <button
                          type="button"
                          onClick={() => onLaunchAction?.(entry)}
                          disabled={!onLaunchAction}
                          data-action-exposure-classification="preview-only"
                          aria-label={`Preview sign ${getPlayerName(entry)}`}
                          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-cockpit-edge bg-cockpit-raised px-2.5 text-xs font-semibold text-cockpit-text-secondary transition-colors hover:bg-cockpit-safe/15 hover:text-cockpit-safe disabled:text-cockpit-text-muted disabled:opacity-70 disabled:hover:bg-cockpit-raised"
                        >
                          <UserPlus aria-hidden className="h-3.5 w-3.5" />
                          Preview Sign
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div
                data-testid="full-cap-free-agent-modal-empty"
                className="flex min-h-36 flex-col items-center justify-center px-4 py-8 text-center"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-cockpit-edge bg-cockpit-raised text-cockpit-text-secondary">
                  <UserPlus aria-hidden className="h-5 w-5" />
                </div>
                <p className="mt-3 text-sm font-semibold text-cockpit-text-primary">
                  No free agents in this pool
                </p>
              </div>
            )}
          </section>

          <aside
            aria-label="Free-agent signing actions"
            className="rounded-lg border border-cockpit-edge bg-cockpit-inlay p-3"
          >
            <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-cockpit-text-secondary">
              Signing Preview
            </h3>
            <div className="mt-3 space-y-2">
              {selectedEntry ? (
                <div className="rounded-md border border-cockpit-edge bg-cockpit-slab px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-cockpit-text-muted">
                    Selected
                  </p>
                  <p className="mt-1 truncate text-sm font-semibold text-cockpit-text-primary">
                    {getPlayerName(selectedEntry)}
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-cockpit-text-muted">
                    {getPlayerMeta(selectedEntry) || 'Free agent'}
                  </p>
                </div>
              ) : null}
              <button
                type="button"
                disabled={!selectedEntry || !onLaunchAction}
                data-action-exposure-classification="preview-only"
                onClick={() => {
                  if (selectedEntry) {
                    onLaunchAction?.(selectedEntry);
                  }
                }}
                className="flex w-full items-center justify-center gap-2 rounded-md border border-cockpit-edge bg-cockpit-raised px-3 py-2 text-xs font-semibold text-cockpit-text-secondary transition-colors hover:bg-cockpit-safe/15 hover:text-cockpit-safe disabled:text-cockpit-text-muted disabled:opacity-70 disabled:hover:bg-cockpit-raised"
              >
                <UserPlus aria-hidden className="h-3.5 w-3.5" />
                Start Preview Signing
              </button>
              {!onLaunchAction ? (
                <p className="text-xs text-cockpit-text-muted">
                  Signing preview unavailable in this context.
                </p>
              ) : null}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};

export { FullCapFreeAgentModal };
