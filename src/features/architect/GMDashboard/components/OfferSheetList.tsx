/**
 * FILE: src/features/architect/GMDashboard/components/OfferSheetList.tsx
 * PURPOSE: Render a list of offer sheets with appropriate actions (Match/Decline/Finalize).
 * OWNERSHIP: Feature: architect/GMDashboard
 *
 * HISTORY:
 *  - 2026-03-14: Migrated authoritative implementation to TypeScript for E91.
 *
 * LINKS:
 *  - Return Package: return_packages/trade_machine/TM_VALIDATOR_TS_FREE_AGENCY_OFFER_SHEET_SURFACE_E91_RETURN_PACKAGE.md
 *  - Master Doc: docs/architect/TRADE_MACHINE_MASTER.md
 */
import React from 'react';

import type {
  OfferSheetLifecycleAction,
  OfferSheetLike,
  OfferSheetListProps,
  OfferSheetSurfaceRole,
} from '../offerSheetTypes';

const formatCurrency = (val: OfferSheetLike['totalValue']) => {
  if (!val) return '$0';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(val as number);
};

type OfferSheetLifecycleSurfaceState =
  | {
      kind: 'actions';
      actions: OfferSheetLifecycleAction[];
    }
  | {
      kind: 'info';
      text: string;
      className: string;
    }
  | {
      kind: 'none';
    };

const OFFER_SHEET_ACTION_LABELS: Record<OfferSheetLifecycleAction, string> = {
  match: 'Match',
  decline: 'Decline',
  finalizeMatched: 'Finalize Match',
  finalizeDeclined: 'Finalize Signing',
};

const OFFER_SHEET_ACTION_TONE_CLASSES: Record<
  OfferSheetLifecycleAction,
  string
> = {
  match: 'bg-blue-600 text-white',
  decline: 'bg-red-600 text-white',
  finalizeMatched: 'bg-green-600 text-white',
  finalizeDeclined: 'bg-green-600 text-white',
};

function getOfferSheetCounterpartyLabel(surfaceRole: OfferSheetSurfaceRole) {
  return surfaceRole === 'incoming' ? 'Offering Team' : 'Target Team';
}

function getOfferSheetCounterpartyCode(
  offerSheet: OfferSheetLike,
  surfaceRole: OfferSheetSurfaceRole
) {
  return surfaceRole === 'incoming'
    ? offerSheet.offeringTeamCode
    : offerSheet.homeTeamCode;
}

function getOfferSheetLifecycleSurfaceState(
  surfaceRole: OfferSheetSurfaceRole,
  status: OfferSheetLike['status']
): OfferSheetLifecycleSurfaceState {
  switch (`${surfaceRole}:${String(status || '').trim()}`) {
    case 'incoming:PENDING_MATCH':
      return {
        kind: 'actions',
        actions: ['match', 'decline'],
      };
    case 'incoming:MATCHED':
      return {
        kind: 'actions',
        actions: ['finalizeMatched'],
      };
    case 'outgoing:DECLINED':
      return {
        kind: 'actions',
        actions: ['finalizeDeclined'],
      };
    case 'outgoing:MATCHED':
      return {
        kind: 'info',
        text: 'Matched by Home Team',
        className: 'text-xs text-blue-300 font-medium',
      };
    case 'outgoing:PENDING_MATCH':
      return {
        kind: 'info',
        text: 'Waiting for home team...',
        className: 'text-xs text-gray-400 italic',
      };
    default:
      return {
        kind: 'none',
      };
  }
}

export const OfferSheetList = ({
  offerSheets = [],
  title = 'Offer Sheets',
  surfaceRole,
  onLifecycleAction,
  actionsDisabled = false,
  actionsDisabledReason = 'Requires an active world to commit.',
}: OfferSheetListProps) => {
  if (!offerSheets || offerSheets.length === 0) {
    return null;
  }

  return (
    <div className="rounded-md border border-white/10 bg-cockpit-slab px-3 py-2">
      <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/55">
        {title}
      </h3>
      {actionsDisabled && (
        <p className="mb-2 text-xs text-amber-400">{actionsDisabledReason}</p>
      )}
      <table className="w-full text-left text-xs text-white/80">
        <thead>
          <tr className="border-b border-white/10 text-[10px] uppercase tracking-wider text-white/40">
            <th className="py-1 font-semibold">Player</th>
            <th className="py-1 font-semibold">{getOfferSheetCounterpartyLabel(surfaceRole)}</th>
            <th className="py-1 font-semibold">Terms</th>
            <th className="py-1 font-semibold">Status</th>
            <th className="py-1 font-semibold">Date</th>
            <th className="py-1 text-right font-semibold">Actions</th>
          </tr>
        </thead>
        <tbody>
          {offerSheets.map((os) => {
            const lifecycleSurfaceState = getOfferSheetLifecycleSurfaceState(
              surfaceRole,
              os.status
            );

            return (
              <tr
                key={os.id}
                className="border-b border-white/5 last:border-0 hover:bg-white/[0.04]"
              >
                <td className="py-1.5 font-medium text-white">{os.playerName}</td>
                <td className="py-1.5">
                  {getOfferSheetCounterpartyCode(os, surfaceRole)}
                </td>
                <td className="py-1.5 tabular-nums">
                  {os.contractYears}y / {formatCurrency(os.totalValue)}
                </td>
                <td className="py-1.5">
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold
                    ${os.status === 'MATCHED' ? 'bg-blue-500/20 text-blue-200' : ''}
                    ${os.status === 'DECLINED' ? 'bg-red-500/20 text-red-200' : ''}
                    ${os.status === 'PENDING_MATCH' ? 'bg-yellow-500/20 text-yellow-100' : ''}
                  `}
                  >
                    {os.status.replace('_', ' ')}
                  </span>
                </td>
                <td className="py-1.5 text-white/45">
                  {new Date(
                    os.createdAt as string | number | Date
                  ).toLocaleDateString()}
                </td>
                <td className="py-1.5 text-right space-x-2">
                  {lifecycleSurfaceState.kind === 'actions' &&
                    lifecycleSurfaceState.actions.map((action) => (
                      <button
                        key={action}
                        onClick={() =>
                          onLifecycleAction?.({
                            action,
                            offerSheet: os,
                            surfaceRole,
                          })
                        }
                        disabled={actionsDisabled}
                        data-action-exposure-classification={
                          actionsDisabled ? 'preview-only' : 'V1 supported'
                        }
                        title={
                          actionsDisabled ? actionsDisabledReason : undefined
                        }
                        className={`${OFFER_SHEET_ACTION_TONE_CLASSES[action]} px-3 py-1 rounded text-xs ${
                          actionsDisabled
                            ? 'opacity-50 cursor-not-allowed'
                            : action === 'decline'
                              ? 'hover:bg-red-700'
                              : action === 'match'
                                ? 'hover:bg-blue-700'
                                : 'hover:bg-green-700'
                        }`}
                      >
                        {OFFER_SHEET_ACTION_LABELS[action]}
                      </button>
                    ))}
                  {lifecycleSurfaceState.kind === 'info' && (
                    <span className={lifecycleSurfaceState.className}>
                      {lifecycleSurfaceState.text}
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
