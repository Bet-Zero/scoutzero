/** Governed append-only renunciation for the saved-world mutation path. */

import {
  type RightsEventLedgerPayload,
  type RightsRenunciationEvent,
} from '@/schemas/rightsEventLedger';
import {
  isDateOnly,
  salaryCapYearWindow,
} from '@/features/architect/utils/governedSeason';
import { appendRightsEvent, createRightsEventLedger } from './rightsEventLedger';
import {
  projectRightsStateAsOf,
  type DatedRightsStateProjection,
} from './rightsStateProjection';

export interface RenounceGovernedRightsRequest {
  ledger: unknown;
  worldId: string;
  teamId: string;
  playerId: string;
  asOfDate: string;
  salaryCapYear: number;
  operationId: string;
  authoringIdentity: string;
  recordedAt: string;
}

export type RenounceGovernedRightsResult =
  | {
      readonly success: true;
      readonly ledger: RightsEventLedgerPayload;
      readonly before: DatedRightsStateProjection;
      readonly after: DatedRightsStateProjection;
      readonly event: RightsRenunciationEvent;
    }
  | {
      readonly success: false;
      readonly error: string;
      readonly before: DatedRightsStateProjection;
    };

export function renounceGovernedRights(
  request: RenounceGovernedRightsRequest
): RenounceGovernedRightsResult {
  const before = projectRightsStateAsOf(request);
  if (before.status !== 'available' || !before.stateReference) {
    return Object.freeze({
      success: false as const,
      error:
        before.status === 'renounced'
          ? 'These rights were already renounced.'
          : before.reasons[0] || 'Governed rights inputs are incomplete.',
      before,
    });
  }

  let ledger: RightsEventLedgerPayload;
  try {
    ledger = createRightsEventLedger(request.ledger);
  } catch (error) {
    return Object.freeze({
      success: false as const,
      error:
        error instanceof Error
          ? error.message
          : 'The governed rights ledger is invalid.',
      before,
    });
  }
  if (
    before.freeAgentStatus === 'RFA' &&
    before.rightOfFirstRefusal === 'active'
  ) {
    return Object.freeze({
      success: false as const,
      error:
        'A Restricted Free Agent cannot be renounced while the Right of First Refusal remains active.',
      before,
    });
  }

  const window = salaryCapYearWindow(request.salaryCapYear);
  const beforeWindow =
    !window ||
    (isDateOnly(request.asOfDate)
      ? request.asOfDate < window.from.slice(0, 10)
      : Date.parse(request.asOfDate) < Date.parse(window.from));
  if (beforeWindow) {
    return Object.freeze({
      success: false as const,
      error:
        'A Veteran Free Agent cannot be renounced before July 1 following the last contract season.',
      before,
    });
  }

  const predecessorKey = before.consumedEventIds.at(-1);
  const predecessor = ledger.events.find(
    (event) => `${event.eventId}@v${event.eventVersion}` === predecessorKey
  );
  if (!predecessor) {
    return Object.freeze({
      success: false as const,
      error: 'The projected rights state has no reachable predecessor event.',
      before,
    });
  }

  const nextStateVersion = before.stateReference.stateVersion + 1;
  const governedEffectiveTime = isDateOnly(request.asOfDate)
    ? Date.parse(`${request.asOfDate}T00:00:00Z`)
    : Date.parse(request.asOfDate);
  const recordedTime = Date.parse(request.recordedAt);
  if (!Number.isFinite(recordedTime)) {
    return Object.freeze({
      success: false as const,
      error: 'The rights renunciation recordedAt value must be a zoned ISO-8601 instant.',
      before,
    });
  }
  const executedAt =
    recordedTime <= governedEffectiveTime
      ? request.recordedAt
      : request.asOfDate;
  const event: RightsRenunciationEvent = Object.freeze({
    eventId: `${ledger.ledgerId}:${request.playerId}:${request.salaryCapYear}:renunciation:${nextStateVersion}`,
    eventVersion: 1,
    eventKind: 'rights-renounced',
    worldId: request.worldId,
    playerId: request.playerId,
    teamId: request.teamId,
    salaryCapYear: request.salaryCapYear,
    executedAt,
    effectiveAt: request.asOfDate,
    recordedAt: request.recordedAt,
    predecessorEventId: predecessor.eventId,
    predecessorState: before.stateReference,
    resultingState: {
      stateId: before.stateReference.stateId,
      stateVersion: nextStateVersion,
    },
    provenance: {
      sourceTransactionId: request.operationId,
      authoringIdentity: request.authoringIdentity,
    },
    recordStatus: 'current',
    supersedesEventVersion: null,
    canonLeafIds: [
      'CBA2-C01.8',
      'CBA2-C14.5',
      'CBA2-C14.6',
      'CBA2-C14.7',
      'CBA2-C14.8',
    ],
    renouncedBirdType: before.birdType as RightsRenunciationEvent['renouncedBirdType'],
    renouncedFreeAgentAmount: before.freeAgentAmount ?? 0,
  });

  let nextLedger: RightsEventLedgerPayload;
  try {
    nextLedger = appendRightsEvent(ledger, event);
  } catch (error) {
    return Object.freeze({
      success: false as const,
      error:
        error instanceof Error
          ? error.message
          : 'The rights renunciation event could not be appended.',
      before,
    });
  }
  const after = projectRightsStateAsOf({ ...request, ledger: nextLedger });
  if (after.status !== 'renounced') {
    return Object.freeze({
      success: false as const,
      error: 'Renunciation did not produce a replayable renounced state.',
      before,
    });
  }

  return Object.freeze({
    success: true as const,
    ledger: nextLedger,
    before,
    after,
    event,
  });
}
