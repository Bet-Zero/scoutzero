import React, { useMemo, useState } from 'react';

import { isEasternInstant } from '@/features/architect/utils/offerSheets/governedOfferSheetTime';
import { GovernedOfferSheetLifecycleZ } from '@/schemas/governedOfferSheet';
import type {
  OfferSheetLifecycleActionEvent,
  OfferSheetLike,
} from '../offerSheetTypes';

type OfferSheetResolutionControlsProps = {
  offerSheet: OfferSheetLike;
  onLifecycleAction?: (event: OfferSheetLifecycleActionEvent) => unknown;
  actionsDisabled: boolean;
  actionsDisabledReason: string;
};

export const OfferSheetResolutionControls = ({
  offerSheet,
  onLifecycleAction,
  actionsDisabled,
  actionsDisabledReason,
}: OfferSheetResolutionControlsProps) => {
  const lifecycle = useMemo(
    () => GovernedOfferSheetLifecycleZ.safeParse(offerSheet.governedLifecycle),
    [offerSheet.governedLifecycle]
  );
  const arenasApplies =
    lifecycle.success && lifecycle.data.reservations.arenasApplies;
  const governedLifecycleReady =
    lifecycle.success && lifecycle.data.status === 'pending-match';
  const [resolutionAt, setResolutionAt] = useState('');
  const [electAverage, setElectAverage] = useState(false);
  const [statementId, setStatementId] = useState('');
  const [relayedAt, setRelayedAt] = useState('');
  const exactResolutionReady = isEasternInstant(resolutionAt);
  const electionReady =
    !electAverage ||
    (statementId.trim().length > 0 && isEasternInstant(relayedAt));
  const governedDisabledReason =
    'This offer sheet is missing the saved notice record required to resolve it.';
  const disabledReason = actionsDisabled
    ? actionsDisabledReason
    : !governedLifecycleReady
      ? governedDisabledReason
      : !exactResolutionReady
        ? 'Enter the exact Eastern resolution time.'
        : undefined;
  const baseDisabled =
    actionsDisabled || !governedLifecycleReady || !exactResolutionReady;

  const emit = (action: 'match' | 'decline') => {
    onLifecycleAction?.({
      action,
      offerSheet,
      surfaceRole: 'incoming',
      resolution: {
        resolutionAt,
        averagingElection:
          action === 'match' && electAverage
            ? {
                statementId: statementId.trim(),
                deliveredToNbaAt: resolutionAt,
                relayedToPlayersAssociationAt: relayedAt,
              }
            : null,
      },
    });
  };

  return (
    <div className="ml-auto w-64 space-y-1.5 text-left">
      {!governedLifecycleReady ? (
        <p className="text-[10px] leading-snug text-amber-300">
          {governedDisabledReason}
        </p>
      ) : null}
      <label className="block text-[10px] uppercase tracking-wide text-white/45">
        Exact resolution time
        <input
          data-testid={`offer-sheet-resolution-at-${offerSheet.id}`}
          value={resolutionAt}
          onChange={(event) => setResolutionAt(event.target.value)}
          placeholder="2026-07-09T17:00:00-04:00"
          className="mt-1 w-full rounded border border-white/15 bg-black/40 px-2 py-1.5 text-[11px] normal-case tracking-normal text-white outline-none focus:border-cyan-400/50"
        />
      </label>
      {arenasApplies ? (
        <div className="rounded border border-white/10 bg-white/[0.03] p-2">
          <label className="flex items-center gap-1.5 text-[10px] text-white/65">
            <input
              type="checkbox"
              checked={electAverage}
              onChange={(event) => setElectAverage(event.target.checked)}
              className="accent-cyan-500"
            />
            Elect average annual Salary
          </label>
          {electAverage ? (
            <div className="mt-2 space-y-1.5">
              <input
                aria-label="Averaging statement reference"
                value={statementId}
                onChange={(event) => setStatementId(event.target.value)}
                placeholder="Written statement reference"
                className="w-full rounded border border-white/15 bg-black/40 px-2 py-1.5 text-[10px] text-white outline-none"
              />
              <input
                aria-label="Players Association relay time"
                value={relayedAt}
                onChange={(event) => setRelayedAt(event.target.value)}
                placeholder="Eastern relay time with offset"
                className="w-full rounded border border-white/15 bg-black/40 px-2 py-1.5 text-[10px] text-white outline-none"
              />
            </div>
          ) : null}
        </div>
      ) : null}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => emit('match')}
          disabled={baseDisabled || !electionReady}
          title={baseDisabled ? disabledReason : undefined}
          className="rounded bg-blue-600 px-3 py-1 text-xs text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          Match
        </button>
        <button
          type="button"
          onClick={() => emit('decline')}
          disabled={baseDisabled}
          title={baseDisabled ? disabledReason : undefined}
          className="rounded bg-red-600 px-3 py-1 text-xs text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          Decline
        </button>
      </div>
    </div>
  );
};
