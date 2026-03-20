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
  playerId?: string | null;
  playerName?: string | null;
  label?: string | null;
  amountByYear?:
    | DeadCapAmountByYearArrayEntry[]
    | Record<string, DeadCapAmountByYearObjectValue>
    | null;
  stretched?: boolean;
};
type FlatDeadMoneyEntry = {
  id: number;
  label: string;
  seasonKey: string | undefined;
  amount: NumericLike;
  stretched: boolean;
  originalEntry?: DeadCapSourceEntry;
  isNew?: boolean;
};
type TeamCapSheetLike = {
  deadCap?: DeadCapSourceEntry[] | null;
};
type ManageDeadMoneyModalProps = {
  isOpen?: boolean;
  onClose: () => void;
  teamCapSheet?: TeamCapSheetLike | null;
  onSave: (deadCap: unknown[]) => unknown | Promise<unknown>;
  currentYear: number;
};

/**
 * Modal for managing dead money entries manually.
 * Phase 24 Execution.
 */
const ManageDeadMoneyModal = ({
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
      // Flatten the canonical schema for UI editing
      // Canonical: { playerId?, amountByYear: { [year]: { amount } }, stretched, label? }
      // UI: { id, label, seasonKey, amount, stretched, originalEntry }

      const flatEntries: FlatDeadMoneyEntry[] = [];
      let entryId = 1;

      (teamCapSheet.deadCap || []).forEach((entry) => {
        const contractName = entry.playerName || entry.label || 'Unknown Entry';
        const isStretched = !!entry.stretched;

        if (Array.isArray(entry.amountByYear)) {
          // Canonical shape: array of { season, amount, isStretched? }
          entry.amountByYear.forEach((yearEntry) => {
            flatEntries.push({
              id: entryId++,
              label: contractName,
              seasonKey: yearEntry.season || undefined,
              amount: yearEntry.amount || 0,
              stretched: !!yearEntry.isStretched || isStretched,
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
              amount: (typeof val === 'object' ? val?.amount : val) || 0,
              stretched: isStretched,
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
    setEntries(entries.map((e) => (e.id === id ? { ...e, [field]: value } : e)));
  };

  const handleDelete = (id: number) => {
    setEntries(entries.filter((e) => e.id !== id));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveError('');

    // Reconstruct canonical schema from flat UI entries
    // Since UI allows free-form editing, we treat each UI row as a distinct "contract" logic for simplicity in manual mode,
    // OR we could try to group them.
    // For manual management, creating one DeadCapEntry per row is safest to avoid accidental merging.

    // Canonical Schema:
    // interface DeadCapEntry {
    //   playerId: string; // generate dummy or use existing
    //   playerName: string;
    //   amountByYear: { [yearKey: string]: { amount: number } };
    //   stretched: boolean;
    //   buyout: boolean;
    // }

    // Canonical Schema per DeadCapItemZ (src/schemas/architect.ts):
    // { playerId, playerName, amountByYear: [{ season, amount, isStretched? }], notes? }
    const canonicalDeadCap = entries.map((e) => {
      return {
        playerId:
          e.originalEntry?.playerId ||
          `manual_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        playerName: e.label,
        amountByYear: [
          {
            season: e.seasonKey,
            amount: Number(e.amount),
            isStretched: !!e.stretched,
          },
        ],
        notes: 'Manual Adjustment',
      };
    });

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

  return (
    <div
      data-testid="manage-dead-money-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
    >
      <div className="bg-[#1a1a1a] border border-white/10 rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="p-4 border-b border-white/10 flex justify-between items-center bg-white/5">
          <h2 className="text-xl font-bold text-white">Manage Dead Money</h2>
          <button
            onClick={onClose}
            className="text-white/50 hover:text-white"
            disabled={isSaving}
          >
            &times;
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="mb-4 text-sm text-white/60 bg-blue-500/10 border border-blue-500/20 p-3 rounded">
            <p>
              <strong>Manual Override Mode:</strong> Use this tool to correct
              data errors or add legacy dead money tables. Changes here will
              replace the team's entire dead money ledger.
            </p>
          </div>

          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-xs uppercase text-white/40 border-b border-white/10">
                <th className="p-2">Description / Player</th>
                <th className="p-2 w-32">Season</th>
                <th className="p-2 w-32">Amount</th>
                <th className="p-2 w-24 text-center">Stretched</th>
                <th className="p-2 w-16"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {entries.map((entry) => (
                <tr key={entry.id} className="group hover:bg-white/5">
                  <td className="p-2">
                    <input
                      type="text"
                      value={entry.label}
                      onChange={(e) =>
                        handleChange(entry.id, 'label', e.target.value)
                      }
                      className="bg-transparent border border-transparent hover:border-white/20 focus:border-blue-500 focus:bg-black/20 rounded px-2 py-1 w-full text-white text-sm"
                      placeholder="e.g. Waived: John Doe"
                    />
                  </td>
                  <td className="p-2">
                    <input
                      type="text"
                      value={entry.seasonKey}
                      onChange={(e) =>
                        handleChange(entry.id, 'seasonKey', e.target.value)
                      }
                      className="bg-transparent border border-transparent hover:border-white/20 focus:border-blue-500 focus:bg-black/20 rounded px-2 py-1 w-full text-white text-sm font-mono"
                      placeholder="YYYY-YY"
                    />
                  </td>
                  <td className="p-2">
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
                      className="bg-transparent border border-transparent hover:border-white/20 focus:border-blue-500 focus:bg-black/20 rounded px-2 py-1 w-full text-white text-sm tabular-nums text-right"
                      min="0"
                    />
                  </td>
                  <td className="p-2 text-center">
                    <input
                      type="checkbox"
                      checked={entry.stretched}
                      onChange={(e) =>
                        handleChange(entry.id, 'stretched', e.target.checked)
                      }
                      className="accent-blue-500"
                    />
                  </td>
                  <td className="p-2 text-right">
                    <button
                      onClick={() => handleDelete(entry.id)}
                      className="text-red-400 hover:text-red-300 opacity-50 group-hover:opacity-100 transition-opacity p-1"
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
                  <td colSpan={5} className="p-8 text-center text-white/30 italic">
                    No dead money entries.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          <div className="mt-4">
            <button
              onClick={handleAdd}
              className="flex items-center gap-2 text-blue-400 hover:text-blue-300 text-sm font-medium px-2 py-1 rounded hover:bg-blue-500/10 transition-colors"
            >
              <span className="text-lg">+</span> Add Entry
            </button>
          </div>
        </div>

        <div className="p-4 border-t border-white/10 bg-black/20">
          {saveError && (
            <div
              role="alert"
              className="mb-3 rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200"
            >
              {saveError}
            </div>
          )}
          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 rounded text-sm font-medium text-white/60 hover:text-white hover:bg-white/5 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-2 rounded text-sm font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20 transition-all hover:scale-105"
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ManageDeadMoneyModal;
