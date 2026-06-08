/**
 * FILE: src/features/architect/capSheet/modals/ManageDeadMoneyModal.tsx
 * PURPOSE: Modal for managing dead money entries manually.
 * OWNERSHIP: Feature: architect/cap-sheet
 *
 * HISTORY:
 *  - 2026-01-21: Phase 24 - Created for manual dead money management
 *  - 2026-03-14: Migrated authoritative implementation to TypeScript for E89.
 */

import React, { useEffect, useState } from 'react';

type NumericLike = number | string | null | undefined;
type DeadCapAmountByYearArrayEntry = {
  season?: string | null;
  amount?: NumericLike;
  isStretched?: boolean;
};
type DeadCapAmountByYearObjectValue =
  | NumericLike
  | {
      amount?: NumericLike;
    };
type DeadCapSourceEntry = {
  playerId?: string | number | null;
  playerName?: string | null;
  label?: string | null;
  originalSalary?: NumericLike;
  amountByYear?:
    | DeadCapAmountByYearArrayEntry[]
    | Record<string, DeadCapAmountByYearObjectValue>
    | null;
  waiveDate?: string | null;
  notes?: string | null;
  stretched?: boolean | null;
};
type FlatDeadMoneyEntry = {
  id: number;
  label: string;
  seasonKey: string | undefined;
  amount: NumericLike;
  stretched: boolean;
  sourceGroupKey?: string;
  originalEntry?: DeadCapSourceEntry;
  isNew?: boolean;
};
type TeamCapSheetLike = {
  deadCap?: DeadCapSourceEntry[] | null;
};
type ManualDeadCapSavePayload = Array<{
  id?: string | null;
  playerId?: string | number | null;
  playerName?: string | null;
  label?: string | null;
  originalSalary?: NumericLike;
  amountByYear?: Array<{
    season: string;
    amount: number;
    isStretched?: boolean;
  }> | null;
  waiveDate?: string | null;
  notes?: string | null;
  stretched?: boolean | null;
}>;
type ManageDeadMoneyModalProps = {
  isOpen?: boolean;
  onClose: () => void;
  teamCapSheet?: TeamCapSheetLike | null;
  onSave: (deadCap: ManualDeadCapSavePayload) => Promise<boolean>;
  currentYear: number;
};

const buildManualDeadCapPlayerId = () =>
  `manual_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

const toDeadCapAmount = (value: NumericLike) => {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
};

const buildDeadCapReplacementPayload = (
  entries: FlatDeadMoneyEntry[]
): ManualDeadCapSavePayload => {
  const entriesBySource = new Map<string, FlatDeadMoneyEntry[]>();

  entries.forEach((entry) => {
    const groupKey = entry.sourceGroupKey || `manual-row-${entry.id}`;
    const groupedEntries = entriesBySource.get(groupKey) || [];
    groupedEntries.push(entry);
    entriesBySource.set(groupKey, groupedEntries);
  });

  return Array.from(entriesBySource.values()).map((groupedEntries) => {
    const firstEntry = groupedEntries[0];
    const originalEntry = firstEntry.originalEntry;
    const payloadEntry: ManualDeadCapSavePayload[number] = {
      playerId: originalEntry?.playerId || buildManualDeadCapPlayerId(),
      playerName:
        firstEntry.label ||
        originalEntry?.playerName ||
        originalEntry?.label ||
        'Manual Dead Money Adjustment',
      amountByYear: groupedEntries.map((entry) => ({
        season: entry.seasonKey || '',
        amount: toDeadCapAmount(entry.amount),
        isStretched: !!entry.stretched,
      })),
      notes: originalEntry?.notes || 'Manual Adjustment',
    };

    if (
      originalEntry?.originalSalary !== undefined &&
      originalEntry.originalSalary !== null
    ) {
      payloadEntry.originalSalary = toDeadCapAmount(originalEntry.originalSalary);
    }

    if (originalEntry?.waiveDate) {
      payloadEntry.waiveDate = originalEntry.waiveDate;
    }

    return payloadEntry;
  });
};

/**
 * Modal for managing dead money entries manually.
 * Phase 24 Execution.
 */
export const ManageDeadMoneyModal = ({
  isOpen,
  onClose,
  teamCapSheet,
  onSave,
  currentYear,
}: ManageDeadMoneyModalProps) => {
  const [entries, setEntries] = useState<FlatDeadMoneyEntry[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Initialize from cap sheet
  useEffect(() => {
    if (isOpen && teamCapSheet?.deadCap) {
      setSaveError('');
      setIsSaving(false);
      // Flatten the canonical schema for UI editing while preserving source
      // grouping so replacement saves can rebuild one multi-season entry.
      // Canonical: { playerId?, amountByYear: [{ season, amount, isStretched? }], notes? }
      // UI: { id, label, seasonKey, amount, stretched, sourceGroupKey, originalEntry }

      const flatEntries: FlatDeadMoneyEntry[] = [];
      let entryId = 1;

      (teamCapSheet.deadCap || []).forEach((entry, entryIndex) => {
        const contractName = entry.playerName || entry.label || 'Unknown Entry';
        const isStretched = !!entry.stretched;
        const sourceGroupKey = `dead-cap-source-${entryIndex}`;

        if (Array.isArray(entry.amountByYear)) {
          // Canonical shape: array of { season, amount, isStretched? }
          entry.amountByYear.forEach((yearEntry) => {
            flatEntries.push({
              id: entryId++,
              label: contractName,
              seasonKey: yearEntry.season || undefined,
              amount: yearEntry.amount ?? 0,
              stretched: !!yearEntry.isStretched || isStretched,
              sourceGroupKey,
              originalEntry: entry,
            });
          });
        } else if (entry.amountByYear && typeof entry.amountByYear === 'object') {
          // Legacy object-map shape: { "2025-26": { amount } }
          Object.entries(entry.amountByYear).forEach(([yearKey, val]) => {
            flatEntries.push({
              id: entryId++,
              label: contractName,
              seasonKey: yearKey,
              amount: (typeof val === 'object' ? val?.amount : val) ?? 0,
              stretched: isStretched,
              sourceGroupKey,
              originalEntry: entry,
            });
          });
        }
      });

      setEntries(flatEntries);
    } else if (isOpen) {
      setSaveError('');
      setIsSaving(false);
      setEntries([]);
    }
  }, [isOpen, teamCapSheet]);

  const handleAdd = () => {
    // Default to current season
    const seasonKey = `${currentYear - 1}-${String(currentYear % 100).padStart(2, '0')}`;
    setEntries([
      ...entries,
      {
        id: Date.now(),
        label: 'New Dead Money Adjustment',
        seasonKey,
        amount: 0,
        stretched: false,
        isNew: true,
      },
    ]);
  };

  const handleChange = (
    id: number,
    field: keyof FlatDeadMoneyEntry,
    value: FlatDeadMoneyEntry[keyof FlatDeadMoneyEntry]
  ) => {
    setEntries((prev) => {
      const targetEntry = prev.find((entry) => entry.id === id);
      const shouldApplyToSourceGroup = field === 'label' && targetEntry?.sourceGroupKey;

      return prev.map((entry) => {
        const isTargetEntry = entry.id === id;
        const isSameSourceGroup =
          shouldApplyToSourceGroup &&
          entry.sourceGroupKey === targetEntry?.sourceGroupKey;

        return isTargetEntry || isSameSourceGroup
          ? { ...entry, [field]: value }
          : entry;
      });
    });
  };

  const handleDelete = (id: number) => {
    setEntries(entries.filter((e) => e.id !== id));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveError('');

    // Full replacement ledger: source-grouped rows are rebuilt into the same
    // canonical multi-season dead-cap entry; unrelated manual rows stay distinct.
    const canonicalDeadCap = buildDeadCapReplacementPayload(entries);

    try {
      const saveResult = await onSave(canonicalDeadCap);
      if (saveResult === false) {
        setSaveError(
          'Failed to save dead money changes. Please fix issues and try again.'
        );
        return;
      }
      onClose();
    } catch (error) {
      setSaveError(
        (error as { message?: string } | null | undefined)?.message ||
          'Failed to save dead money changes. Please fix issues and try again.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  const currentSeasonKey = `${currentYear - 1}-${String(currentYear % 100).padStart(2, '0')}`;
  const totalAllSeasons = entries.reduce(
    (sum, entry) => sum + toDeadCapAmount(entry.amount),
    0
  );
  const totalCurrentSeason = entries
    .filter((entry) => entry.seasonKey === currentSeasonKey)
    .reduce((sum, entry) => sum + toDeadCapAmount(entry.amount), 0);
  const formatMoney = (value: number) => `$${value.toLocaleString()}`;

  return (
    <div
      data-testid="manage-dead-money-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm"
    >
      <div className="w-full max-w-4xl max-h-[88vh] flex flex-col overflow-hidden rounded-2xl border border-white/12 bg-[#0f0f0f] shadow-2xl shadow-black/60">
        {/* Header */}
        <div className="relative overflow-hidden border-b border-white/10 bg-gradient-to-r from-rose-500/10 via-white/[0.03] to-transparent px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-500/15 text-rose-300 ring-1 ring-rose-400/20">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="2" x2="12" y2="22" />
                  <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-bold leading-tight text-white">
                  Manage Dead Money
                </h2>
                <p className="text-[11px] font-medium uppercase tracking-[0.15em] text-white/40">
                  Manual ledger override
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-xl text-white/40 transition-colors hover:bg-white/5 hover:text-white"
              disabled={isSaving}
              aria-label="Close"
            >
              &times;
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {/* Summary band */}
          <div className="mb-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">
                Dead Money · {currentSeasonKey}
              </div>
              <div className="mt-1 font-mono text-xl font-bold tabular-nums text-rose-200">
                {formatMoney(totalCurrentSeason)}
              </div>
            </div>
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">
                All Scheduled Seasons
              </div>
              <div className="mt-1 font-mono text-xl font-bold tabular-nums text-white/80">
                {formatMoney(totalAllSeasons)}
              </div>
            </div>
          </div>

          <p className="mb-4 text-xs leading-relaxed text-white/50">
            <strong className="text-white/70">Manual override mode.</strong> Use
            this to correct data errors or add legacy dead-money tables. Saving
            replaces the team&rsquo;s entire dead-money ledger.
          </p>

          <div className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.02]">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.03] text-[10px] uppercase tracking-[0.14em] text-white/40">
                  <th className="px-3 py-2.5 font-semibold">Description / Player</th>
                  <th className="px-3 py-2.5 w-32 font-semibold">Season</th>
                  <th className="px-3 py-2.5 w-36 text-right font-semibold">Amount</th>
                  <th className="px-3 py-2.5 w-24 text-center font-semibold">Stretched</th>
                  <th className="px-3 py-2.5 w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {entries.map((entry) => (
                  <tr key={entry.id} className="group transition-colors hover:bg-white/[0.03]">
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={entry.label}
                        onChange={(e) =>
                          handleChange(entry.id, 'label', e.target.value)
                        }
                        className="w-full rounded-md border border-transparent bg-black/20 px-2 py-1 text-sm text-white transition-colors hover:border-white/20 focus:border-rose-500/60 focus:bg-black/40 focus:outline-none"
                        placeholder="e.g. Waived: John Doe"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={entry.seasonKey}
                        onChange={(e) =>
                          handleChange(entry.id, 'seasonKey', e.target.value)
                        }
                        className="w-full rounded-md border border-transparent bg-black/20 px-2 py-1 font-mono text-sm text-white transition-colors hover:border-white/20 focus:border-rose-500/60 focus:bg-black/40 focus:outline-none"
                        placeholder="YYYY-YY"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <div className="relative">
                        <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-sm text-white/40">
                          $
                        </span>
                        <input
                          type="number"
                          value={entry.amount ?? ''}
                          onChange={(e) =>
                            handleChange(
                              entry.id,
                              'amount',
                              parseFloat(e.target.value)
                            )
                          }
                          className="w-full rounded-md border border-transparent bg-black/20 px-2 py-1 pl-5 text-right text-sm tabular-nums text-white transition-colors hover:border-white/20 focus:border-rose-500/60 focus:bg-black/40 focus:outline-none"
                          min="0"
                        />
                      </div>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={entry.stretched}
                        onChange={(e) =>
                          handleChange(entry.id, 'stretched', e.target.checked)
                        }
                        className="h-4 w-4 cursor-pointer accent-rose-500"
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        onClick={() => handleDelete(entry.id)}
                        className="p-1 text-red-400/70 opacity-60 transition-opacity hover:text-red-300 group-hover:opacity-100"
                        title="Remove Entry"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-4 w-4"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path
                            fillRule="evenodd"
                            d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
                {entries.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-10 text-center text-sm italic text-white/30">
                      No dead money entries.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-3">
            <button
              onClick={handleAdd}
              className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-1.5 text-sm font-medium text-rose-300 transition-colors hover:bg-rose-500/20"
            >
              <span className="text-base leading-none">+</span> Add Entry
            </button>
          </div>
        </div>

        <div className="border-t border-white/10 bg-black/30 px-6 py-4">
          {saveError && (
            <div
              role="alert"
              className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200"
            >
              {saveError}
            </div>
          )}
          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              disabled={isSaving}
              className="rounded-lg px-4 py-2 text-sm font-medium text-white/60 transition-colors hover:bg-white/5 hover:text-white"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="rounded-lg bg-rose-600 px-5 py-2 text-sm font-bold text-white shadow-lg shadow-rose-900/20 transition-all hover:bg-rose-500 disabled:opacity-50"
            >
              {isSaving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

