/**
 * FILE: src/features/architect/capSheet/modals/ManageExceptionsModal.jsx
 * PURPOSE: Modal for managing team exception usage entries manually (MLE, TPMLE, BAE, ROOM).
 * OWNERSHIP: Feature: architect/cap-sheet
 *
 * HISTORY:
 *  - 2026-01-21: Phase 27 - Created for Manual Exception Management
 *
 * LINKS:
 *  - Plan: Phase 27 execution prompt
 *  - Master Doc: docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md
 */

import React, { useState, useEffect } from 'react';
import { getCapSettingsForYear } from '@/features/architect/utils/tradeMachine/utils/capSettingsProvider';

/**
 * Exception types supported for manual management.
 * TPE is explicitly NOT included in Phase 27 scope.
 */
const EXCEPTION_TYPES = ['mle', 'tpmle', 'bae', 'room'];

const EXCEPTION_LABELS = {
  mle: 'Mid-Level Exception (MLE)',
  tpmle: 'Taxpayer MLE',
  bae: 'Bi-Annual Exception (BAE)',
  room: 'Room Exception',
};

const DEFAULT_EXCEPTION = {
  enabled: false,
  totalAmount: 0,
  usedAmount: 0,
  seasonKey: '',
  notes: '',
};

/**
 * Get default totals for exceptions based on cap settings
 */
const getDefaultTotalAmount = (type, capSettings) => {
  if (!capSettings) return 0;
  switch (type) {
    case 'mle':
      return capSettings.nonTaxMLE || capSettings.mle || 0;
    case 'tpmle':
      return capSettings.taxMLE || capSettings.tpmle || 0;
    case 'bae':
      return capSettings.bae || 0;
    case 'room':
      return capSettings.roomMLE || capSettings.room || 0;
    default:
      return 0;
  }
};

/**
 * Modal for managing team exceptions manually.
 * Phase 27 Execution.
 */
const ManageExceptionsModal = ({
  isOpen,
  onClose,
  teamCapSheet,
  onSave,
  currentYear,
}) => {
  const [exceptions, setExceptions] = useState({});
  const [capSettings, setCapSettings] = useState(null);

  // Get the season key from currentYear
  const seasonKey = `${currentYear - 1}-${String(currentYear % 100).padStart(2, '0')}`;

  // Load cap settings for current year
  useEffect(() => {
    try {
      const settings = getCapSettingsForYear(currentYear);
      setCapSettings(settings);
    } catch (e) {
      console.warn('Could not load cap settings for year:', currentYear, e);
    }
  }, [currentYear]);

  // Initialize from cap sheet exceptions
  useEffect(() => {
    if (isOpen && teamCapSheet) {
      const existingExceptions = teamCapSheet.exceptions || {};

      // Build initial state for each exception type
      const initialState = {};
      EXCEPTION_TYPES.forEach((type) => {
        const existing = existingExceptions[type];
        if (existing && typeof existing === 'object') {
          initialState[type] = {
            enabled: existing.enabled ?? true,
            totalAmount:
              existing.totalAmount ??
              getDefaultTotalAmount(type, capSettings) ??
              0,
            usedAmount: existing.usedAmount ?? 0,
            seasonKey: existing.seasonKey ?? seasonKey,
            notes: existing.notes ?? '',
          };
        } else {
          // Initialize with defaults
          initialState[type] = {
            ...DEFAULT_EXCEPTION,
            totalAmount: getDefaultTotalAmount(type, capSettings),
            seasonKey,
          };
        }
      });

      setExceptions(initialState);
    }
  }, [isOpen, teamCapSheet, capSettings, seasonKey]);

  const handleChange = (type, field, value) => {
    setExceptions((prev) => ({
      ...prev,
      [type]: {
        ...prev[type],
        [field]: value,
      },
    }));
  };

  const handleToggle = (type) => {
    setExceptions((prev) => ({
      ...prev,
      [type]: {
        ...prev[type],
        enabled: !prev[type]?.enabled,
      },
    }));
  };

  const handleSave = () => {
    // Build the canonical exceptions object
    // Only include enabled exceptions or those with non-zero values
    const canonicalExceptions = {};

    EXCEPTION_TYPES.forEach((type) => {
      const exc = exceptions[type];
      if (exc && (exc.enabled || exc.usedAmount > 0)) {
        canonicalExceptions[type] = {
          enabled: !!exc.enabled,
          totalAmount: Number(exc.totalAmount) || 0,
          usedAmount: Number(exc.usedAmount) || 0,
          seasonKey: exc.seasonKey || seasonKey,
          notes: exc.notes || undefined,
        };
        // Clean up undefined notes
        if (!canonicalExceptions[type].notes) {
          delete canonicalExceptions[type].notes;
        }
      }
    });

    onSave(canonicalExceptions);
    onClose();
  };

  const formatCurrency = (value) => {
    return `$${(value || 0).toLocaleString()}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-[#1a1a1a] border border-white/10 rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="p-4 border-b border-white/10 flex justify-between items-center bg-white/5">
          <h2 className="text-xl font-bold text-white">Manage Exceptions</h2>
          <button
            onClick={onClose}
            className="text-white/50 hover:text-white text-2xl"
          >
            &times;
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="mb-4 text-sm text-white/60 bg-blue-500/10 border border-blue-500/20 p-3 rounded">
            <p>
              <strong>Exception Management:</strong> Configure which exceptions
              are available for the team and track their usage. Changes here
              will update the team's exception state for the current season (
              {seasonKey}).
            </p>
          </div>

          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-xs uppercase text-white/40 border-b border-white/10">
                <th className="p-2 w-16 text-center">Enabled</th>
                <th className="p-2">Exception Type</th>
                <th className="p-2 w-36">Total Amount</th>
                <th className="p-2 w-36">Used Amount</th>
                <th className="p-2 w-28">Remaining</th>
                <th className="p-2">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {EXCEPTION_TYPES.map((type) => {
                const exc = exceptions[type] || DEFAULT_EXCEPTION;
                const remaining =
                  (exc.totalAmount || 0) - (exc.usedAmount || 0);
                const isOverused = remaining < 0;

                return (
                  <tr
                    key={type}
                    className={`group hover:bg-white/5 ${!exc.enabled ? 'opacity-50' : ''}`}
                  >
                    <td className="p-2 text-center">
                      <input
                        type="checkbox"
                        checked={exc.enabled}
                        onChange={() => handleToggle(type)}
                        className="accent-blue-500 w-4 h-4"
                      />
                    </td>
                    <td className="p-2">
                      <span className="text-sm font-medium text-white/90">
                        {EXCEPTION_LABELS[type]}
                      </span>
                      <span className="block text-[10px] text-white/40 uppercase">
                        {type.toUpperCase()}
                      </span>
                    </td>
                    <td className="p-2">
                      <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-white/40 text-sm">
                          $
                        </span>
                        <input
                          type="number"
                          value={exc.totalAmount}
                          onChange={(e) =>
                            handleChange(
                              type,
                              'totalAmount',
                              parseFloat(e.target.value) || 0
                            )
                          }
                          className="bg-transparent border border-transparent hover:border-white/20 focus:border-blue-500 focus:bg-black/20 rounded px-2 py-1 pl-5 w-full text-white text-sm tabular-nums text-right"
                          min="0"
                          disabled={!exc.enabled}
                        />
                      </div>
                    </td>
                    <td className="p-2">
                      <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-white/40 text-sm">
                          $
                        </span>
                        <input
                          type="number"
                          value={exc.usedAmount}
                          onChange={(e) =>
                            handleChange(
                              type,
                              'usedAmount',
                              parseFloat(e.target.value) || 0
                            )
                          }
                          className="bg-transparent border border-transparent hover:border-white/20 focus:border-blue-500 focus:bg-black/20 rounded px-2 py-1 pl-5 w-full text-white text-sm tabular-nums text-right"
                          min="0"
                          disabled={!exc.enabled}
                        />
                      </div>
                    </td>
                    <td className="p-2">
                      <span
                        className={`text-sm font-medium tabular-nums ${isOverused ? 'text-red-400' : 'text-green-400'}`}
                      >
                        {formatCurrency(remaining)}
                      </span>
                    </td>
                    <td className="p-2">
                      <input
                        type="text"
                        value={exc.notes || ''}
                        onChange={(e) =>
                          handleChange(type, 'notes', e.target.value)
                        }
                        className="bg-transparent border border-transparent hover:border-white/20 focus:border-blue-500 focus:bg-black/20 rounded px-2 py-1 w-full text-white text-sm"
                        placeholder="Optional notes..."
                        disabled={!exc.enabled}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Usage Summary */}
          <div className="mt-6 p-4 bg-white/[0.02] border border-white/5 rounded">
            <h3 className="text-sm font-bold text-white/70 mb-2">
              Reference: Default Exception Amounts ({seasonKey})
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {EXCEPTION_TYPES.map((type) => (
                <div key={type} className="text-xs">
                  <span className="text-white/40 uppercase">{type}:</span>
                  <span className="ml-1 text-white/60 tabular-nums">
                    {formatCurrency(getDefaultTotalAmount(type, capSettings))}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-white/10 bg-black/20 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded text-sm font-medium text-white/60 hover:text-white hover:bg-white/5 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 rounded text-sm font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20 transition-all hover:scale-105"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};

export default ManageExceptionsModal;
