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
        className: 'text-xs text-blue-600 font-medium',
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
    <div className="bg-white rounded-lg shadow p-4 mb-6">
      <h3 className="text-lg font-bold mb-4">{title}</h3>
      {actionsDisabled && (
        <p className="text-xs text-amber-700 mb-3">{actionsDisabledReason}</p>
      )}
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b">
            <th className="py-2">Player</th>
            <th className="py-2">{getOfferSheetCounterpartyLabel(surfaceRole)}</th>
            <th className="py-2">Terms</th>
            <th className="py-2">Status</th>
            <th className="py-2">Date</th>
            <th className="py-2 text-right">Actions</th>
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
                className="border-b last:border-0 hover:bg-gray-50"
              >
                <td className="py-3 font-medium">{os.playerName}</td>
                <td className="py-3">
                  {getOfferSheetCounterpartyCode(os, surfaceRole)}
                </td>
                <td className="py-3">
                  {os.contractYears}y / {formatCurrency(os.totalValue)}
                </td>
                <td className="py-3">
                  <span
                    className={`px-2 py-1 rounded text-xs font-bold
                    ${os.status === 'MATCHED' ? 'bg-blue-100 text-blue-800' : ''}
                    ${os.status === 'DECLINED' ? 'bg-red-100 text-red-800' : ''}
                    ${os.status === 'PENDING_MATCH' ? 'bg-yellow-100 text-yellow-800' : ''}
                  `}
                  >
                    {os.status.replace('_', ' ')}
                  </span>
                </td>
                <td className="py-3 text-gray-500">
                  {new Date(
                    os.createdAt as string | number | Date
                  ).toLocaleDateString()}
                </td>
                <td className="py-3 text-right space-x-2">
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

