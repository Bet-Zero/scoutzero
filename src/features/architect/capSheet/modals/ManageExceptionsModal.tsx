/**
 * FILE: src/features/architect/capSheet/modals/ManageExceptionsModal.tsx
 * PURPOSE: Modal for managing team exception usage entries manually (MLE, TPMLE, BAE, ROOM).
 * OWNERSHIP: Feature: architect/cap-sheet
 *
 * HISTORY:
 *  - 2026-01-21: Phase 27 - Created for Manual Exception Management
 *  - 2026-03-14: Migrated authoritative implementation to TypeScript for E89.
 *
 * LINKS:
 *  - Plan: Phase 27 execution prompt
 *  - Master Doc: docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  getCapSettingsForYear,
  getExceptionDefaultAmountFromCapSettings,
} from '@/features/architect/utils/tradeMachine/utils/capSettingsProvider';
import {
  canUseRoomException,
  type TeamCapSheetLike as CapTotalsTeamCapSheetLike,
} from '@/features/architect/utils/capTotals/computeTeamCapTotals';
import { getCanonicalExceptionEntry } from '@/features/architect/utils/exceptions/exceptionOwnership';

/**
 * Exception types supported for manual management.
 * TPE is explicitly NOT included in Phase 27 scope.
 */
const EXCEPTION_TYPES = ['mle', 'tpmle', 'bae', 'room'] as const;

const EXCEPTION_LABELS: Record<ExceptionType, string> = {
  mle: 'Mid-Level Exception (MLE)',
  tpmle: 'Taxpayer MLE',
  bae: 'Bi-Annual Exception (BAE)',
  room: 'Room Exception',
};

type NumericLike = number | string | null | undefined;
type ExceptionType = (typeof EXCEPTION_TYPES)[number];
type CapSettingsLike = ReturnType<typeof getCapSettingsForYear>;
type EditableException = {
  enabled: boolean;
  totalAmount: NumericLike;
  usedAmount: NumericLike;
  seasonKey: string;
  notes: string;
};
type ExceptionsState = Partial<Record<ExceptionType, EditableException>>;
type DisabledExceptionTypes = Partial<Record<ExceptionType, boolean>>;
type TeamCapSheetLike = CapTotalsTeamCapSheetLike & {
  exceptions?: Record<string, unknown> | null;
};
type ManualExceptionEntry = {
  type?: string | null;
  enabled?: boolean | null;
  available?: boolean | null;
  totalAmount?: number | null;
  maxAmount?: number | null;
  amount?: number | null;
  usedAmount?: number | null;
  remainingAmount?: number | null;
  createdFrom?: string | null;
  createdOn?: string | null;
  expiresOn?: string | null;
  notes?: string | null;
  seasonKey?: string | null;
  lastUsedAt?: string | null;
};
type ManualTradeExceptionEntry = {
  id: string;
  totalAmount?: number | null;
  usedAmount?: number | null;
  remainingAmount?: number | null;
  createdFrom?: string | null;
  createdOn?: string | null;
  expiresOn?: string | null;
  notes?: string | null;
};
type ManualExceptionsSavePayload = {
  mle?: ManualExceptionEntry | null;
  taxpayerMle?: ManualExceptionEntry | null;
  tpmle?: ManualExceptionEntry | null;
  room?: ManualExceptionEntry | null;
  bae?: ManualExceptionEntry | null;
  dpe?: ManualExceptionEntry | null;
  tpe?: ManualTradeExceptionEntry[];
} & Record<string, unknown>;
type ManageExceptionsModalProps = {
  isOpen?: boolean;
  onClose: () => void;
  teamCapSheet?: TeamCapSheetLike | null;
  onSave: (exceptions: ManualExceptionsSavePayload) => Promise<boolean>;
  currentYear: number;
};

const DEFAULT_EXCEPTION: EditableException = {
  enabled: false,
  totalAmount: 0,
  usedAmount: 0,
  seasonKey: '',
  notes: '',
};

const toExceptionAmount = (value: NumericLike) => {
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.max(0, amount) : 0;
};

const buildOwnedCurrentSeasonExceptionEntry = (
  type: ExceptionType,
  exception: EditableException | undefined,
  currentSeasonKey: string
): ManualExceptionEntry => {
  const totalAmount = toExceptionAmount(exception?.totalAmount);
  const usedAmount = toExceptionAmount(exception?.usedAmount);
  const remainingAmount = Math.max(0, totalAmount - usedAmount);
  const enabled = !!exception?.enabled;
  const notes = exception?.notes?.trim();
  const canonicalEntry: ManualExceptionEntry = {
    type,
    enabled,
    available: enabled,
    totalAmount,
    maxAmount: totalAmount,
    amount: totalAmount,
    usedAmount,
    remainingAmount,
    seasonKey: currentSeasonKey,
  };

  if (notes) {
    canonicalEntry.notes = notes;
  }

  return canonicalEntry;
};

const shouldPersistOwnedCurrentSeasonException = (
  exception: ManualExceptionEntry
) => !!exception.enabled || toExceptionAmount(exception.usedAmount) > 0;

const buildOwnedCurrentSeasonExceptionsSnapshot = (
  exceptions: ExceptionsState,
  currentSeasonKey: string,
  disabledExceptionTypes: DisabledExceptionTypes = {}
): ManualExceptionsSavePayload => {
  const ownedCurrentSeasonExceptions: ManualExceptionsSavePayload = {};

  EXCEPTION_TYPES.forEach((type) => {
    // Eligibility-disabled edit rows are forced into clear shape before the
    // owned snapshot filter runs, so disabled UI state cannot save as enabled.
    const exception = disabledExceptionTypes[type]
      ? {
          ...(exceptions[type] || DEFAULT_EXCEPTION),
          enabled: false,
          usedAmount: 0,
        }
      : exceptions[type];
    const canonicalEntry = buildOwnedCurrentSeasonExceptionEntry(
      type,
      exception,
      currentSeasonKey
    );

    // Omission is the explicit clear signal for this owned current-season
    // bucket; the mutation layer preserves non-editable buckets such as TPE/DPE.
    if (shouldPersistOwnedCurrentSeasonException(canonicalEntry)) {
      ownedCurrentSeasonExceptions[type] = canonicalEntry;
    }
  });

  return ownedCurrentSeasonExceptions;
};

/**
 * Modal for managing team exceptions manually.
 * Phase 27 Execution.
 */
export const ManageExceptionsModal = ({
  isOpen,
  onClose,
  teamCapSheet,
  onSave,
  currentYear,
}: ManageExceptionsModalProps) => {
  const [exceptions, setExceptions] = useState<ExceptionsState>({});
  const [capSettings, setCapSettings] = useState<CapSettingsLike | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Get the season key from currentYear
  const seasonKey = `${currentYear - 1}-${String(currentYear % 100).padStart(2, '0')}`;

  // Phase 75: Compute room exception eligibility using SSOT totals
  const roomExceptionEligibility = useMemo(() => {
    if (!teamCapSheet || !currentYear) {
      return { eligible: false, reason: 'Missing team data' };
    }
    return canUseRoomException(teamCapSheet, currentYear);
  }, [teamCapSheet, currentYear]);

  // Load cap settings for current year
  useEffect(() => {
    try {
      const settings = getCapSettingsForYear(currentYear) as CapSettingsLike;
      setCapSettings(settings);
    } catch (e) {
      console.warn('Could not load cap settings for year:', currentYear, e);
    }
  }, [currentYear]);

  // Initialize from cap sheet exceptions.
  //
  // Exceptions are NOT user-authored numbers: the amount is fixed by the CBA
  // (cap settings) and usage is consumed automatically when players are signed.
  // So `totalAmount` is sourced from cap settings and `usedAmount` is read back
  // from the team's actual exception state — both read-only here. The only
  // human input is the availability toggle (`enabled`).
  useEffect(() => {
    if (isOpen && teamCapSheet) {
      setSaveError('');
      setIsSaving(false);
      const initialState: ExceptionsState = {};
      EXCEPTION_TYPES.forEach((type) => {
        const existing = getCanonicalExceptionEntry(teamCapSheet, type);
        initialState[type] = {
          enabled: existing?.enabled ?? false,
          // CBA-fixed amount for the season (read-only).
          totalAmount: getExceptionDefaultAmountFromCapSettings(
            type,
            capSettings
          ),
          // Consumed by signings (read-only).
          usedAmount: existing?.usedAmount ?? 0,
          seasonKey,
          notes: existing?.notes ?? '',
        };
      });

      setExceptions(initialState);
    }
  }, [isOpen, teamCapSheet, capSettings, seasonKey]);

  const handleToggle = (type: ExceptionType) => {
    setExceptions((prev) => ({
      ...prev,
      [type]: {
        ...(prev[type] || {}),
        enabled: !prev[type]?.enabled,
      },
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveError('');

    const canonicalExceptions = buildOwnedCurrentSeasonExceptionsSnapshot(
      exceptions,
      seasonKey,
      {
        room: !roomExceptionEligibility.eligible,
      }
    );

    try {
      const saveResult = await onSave(canonicalExceptions);
      if (saveResult === false) {
        setSaveError(
          'Failed to save exceptions. Please fix issues and try again.'
        );
        return;
      }
      onClose();
    } catch (error) {
      setSaveError(
        (error as { message?: string } | null | undefined)?.message ||
          'Failed to save exceptions. Please fix issues and try again.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const formatCurrency = (value: NumericLike) => {
    return `$${((value || 0) as number | string).toLocaleString()}`;
  };

  // B2: surface the one-MLE-per-season rule. Non-Taxpayer MLE, Taxpayer MLE,
  // and Room are mutually exclusive — flag when more than one is enabled.
  const enabledMleFlavors = (['mle', 'tpmle', 'room'] as const).filter(
    (type) => exceptions[type]?.enabled
  );
  const multipleMleFlavorsEnabled = enabledMleFlavors.length > 1;

  // B1: surface the BAE biennial restriction. The canonical entry carries the
  // season it was last consumed; if that was last season, it is locked out now.
  const baeLastUsedSeasonEndYear =
    getCanonicalExceptionEntry(teamCapSheet, 'bae')?.lastUsedSeasonEndYear ??
    null;
  const baeBiennialBlocked =
    typeof baeLastUsedSeasonEndYear === 'number' &&
    baeLastUsedSeasonEndYear === currentYear - 1;

  if (!isOpen) return null;

  return (
    <div
      data-testid="manage-exceptions-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm"
    >
      <div className="w-full max-w-4xl max-h-[88vh] flex flex-col overflow-hidden rounded-2xl border border-white/12 bg-[#0f0f0f] shadow-2xl shadow-black/60">
        {/* Header */}
        <div className="relative overflow-hidden border-b border-white/10 bg-gradient-to-r from-amber-500/10 via-white/[0.03] to-transparent px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/15 text-amber-300 ring-1 ring-amber-400/20">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2 2 7l10 5 10-5-10-5Z" />
                  <path d="m2 17 10 5 10-5" />
                  <path d="m2 12 10 5 10-5" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-bold leading-tight text-white">
                  Manage Exceptions
                </h2>
                <p className="text-[11px] font-medium uppercase tracking-[0.15em] text-white/40">
                  Current season · {seasonKey}
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
          <p className="mb-4 text-xs leading-relaxed text-white/50">
            Exceptions are how you sign players over the cap. Amounts are fixed
            by the CBA and usage is tracked automatically as you sign players —
            so there&rsquo;s nothing to type here. Just mark which exceptions
            your team is carrying this season ({seasonKey}); the Cap Sheet and
            signing flow handle the rest.
          </p>

          {/* B2: one-MLE-per-season warning */}
          {multipleMleFlavorsEnabled && (
            <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-200">
              <span aria-hidden>⚠</span>
              <span>
                Only one of the Non-Taxpayer MLE, Taxpayer MLE, or Room
                Exception may be <strong>used</strong> per season. More than one
                is marked available — a signing will be blocked once a second
                flavor is consumed.
              </span>
            </div>
          )}

          <div className="space-y-2.5">
            {EXCEPTION_TYPES.map((type) => {
              const exc = exceptions[type] || DEFAULT_EXCEPTION;
              const total = Number(exc.totalAmount) || 0;
              const used = Number(exc.usedAmount) || 0;
              const remaining = total - used;
              const isOverused = remaining < 0;

              const isRoomException = type === 'room';
              const roomDisabledByEligibility =
                isRoomException && !roomExceptionEligibility.eligible;
              const baeDisabledByBiennial = type === 'bae' && baeBiennialBlocked;
              const isDisabled =
                roomDisabledByEligibility || baeDisabledByBiennial;
              const isOn = exc.enabled && !isDisabled;

              const statusBadge = isDisabled
                ? {
                    label: roomDisabledByEligibility
                      ? 'Unavailable · over cap'
                      : 'Locked · used last season',
                    cls: 'bg-white/5 text-white/40',
                  }
                : isOn
                  ? used > 0
                    ? { label: 'In use', cls: 'bg-amber-500/15 text-amber-300' }
                    : { label: 'Available', cls: 'bg-emerald-500/15 text-emerald-300' }
                  : { label: 'Not carried', cls: 'bg-white/5 text-white/40' };

              const stat = (label: string, value: string, valueCls = 'text-white/90') => (
                <div>
                  <div className="text-[9px] font-semibold uppercase tracking-[0.16em] text-white/35">
                    {label}
                  </div>
                  <div className={`mt-0.5 font-mono text-sm font-semibold tabular-nums ${valueCls}`}>
                    {value}
                  </div>
                </div>
              );

              return (
                <div
                  key={type}
                  className={`rounded-xl border px-4 py-3 transition-colors ${
                    isOn
                      ? 'border-amber-500/25 bg-amber-500/[0.04]'
                      : 'border-white/10 bg-white/[0.02]'
                  } ${isDisabled ? 'opacity-70' : ''}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <label className="flex min-w-0 items-center gap-3">
                      <input
                        type="checkbox"
                        checked={isOn}
                        onChange={() => !isDisabled && handleToggle(type)}
                        className={`h-4 w-4 shrink-0 accent-amber-500 ${isDisabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                        disabled={isDisabled}
                        aria-label={`Carry ${EXCEPTION_LABELS[type]}`}
                        title={
                          roomDisabledByEligibility
                            ? 'Room Exception is only available to teams operating under the salary cap'
                            : baeDisabledByBiennial
                              ? 'BAE was used last season; it can only be used every other season'
                              : `Mark whether the team is carrying the ${EXCEPTION_LABELS[type]}`
                        }
                      />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-white/90">
                          {EXCEPTION_LABELS[type]}
                        </span>
                        <span className="block text-[10px] uppercase tracking-wider text-white/40">
                          {type.toUpperCase()}
                        </span>
                      </span>
                    </label>
                    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${statusBadge.cls}`}>
                      {statusBadge.label}
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-2 border-t border-white/[0.06] pt-3">
                    {stat('Amount', formatCurrency(total))}
                    {stat('Used', formatCurrency(used), used > 0 ? 'text-amber-300' : 'text-white/50')}
                    {stat(
                      'Remaining',
                      formatCurrency(remaining),
                      isOverused ? 'text-red-400' : 'text-emerald-400'
                    )}
                  </div>

                  {roomDisabledByEligibility && (
                    <p className="mt-2 text-[11px] text-amber-400/90">
                      ⚠ Only available to teams under the salary cap.
                    </p>
                  )}
                  {baeDisabledByBiennial && (
                    <p className="mt-2 text-[11px] text-amber-400/90">
                      ⚠ The Bi-Annual Exception was used last season — it can
                      only be used every other season.
                    </p>
                  )}
                </div>
              );
            })}
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
              className="rounded-lg bg-amber-600 px-5 py-2 text-sm font-bold text-white shadow-lg shadow-amber-900/20 transition-all hover:bg-amber-500 disabled:opacity-50"
            >
              {isSaving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

