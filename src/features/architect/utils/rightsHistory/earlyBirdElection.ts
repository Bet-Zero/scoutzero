/** Written Early Bird election onto the Non-Bird new-contract path. */

import {
  type EarlyBirdElectionEvent,
  type RightsEventLedgerPayload,
} from '@/schemas/rightsEventLedger';
import { isDateOnly } from '@/features/architect/utils/governedSeason';
import { appendRightsEvent, createRightsEventLedger } from './rightsEventLedger';
import {
  projectRightsStateAsOf,
  type DatedRightsStateProjection,
} from './rightsStateProjection';

export interface ElectEarlyBirdNonBirdRequest {
  ledger: unknown;
  worldId: string;
  teamId: string;
  playerId: string;
  asOfDate: string;
  salaryCapYear: number;
  electedContractId: string;
  operationId: string;
  authoringIdentity: string;
  recordedAt: string;
}

export type ElectEarlyBirdNonBirdResult =
  | {
      readonly success: true;
      readonly ledger: RightsEventLedgerPayload;
      readonly before: DatedRightsStateProjection;
      readonly after: DatedRightsStateProjection;
      readonly event: EarlyBirdElectionEvent;
    }
  | {
      readonly success: false;
      readonly error: string;
      readonly before: DatedRightsStateProjection;
    };

/**
 * Record the team's written election to use Non-Bird authority for one new
 * contract. This does not sign a contract or spend an exception.
 */
export function electEarlyBirdNonBirdForContract(
  request: ElectEarlyBirdNonBirdRequest
): ElectEarlyBirdNonBirdResult {
  const before = projectRightsStateAsOf(request);
  if (
    before.status !== 'available' ||
    !before.stateReference ||
    before.birdType !== 'Early Bird'
  ) {
    return Object.freeze({
      success: false as const,
      error:
        before.status === 'available'
          ? 'The written Non-Bird election is available only from Early Bird rights.'
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
  if (before.signingBirdType === 'Non-Bird') {
    return Object.freeze({
      success: false as const,
      error: 'The written Non-Bird election was already recorded.',
      before,
    });
  }
  if (!request.electedContractId.trim()) {
    return Object.freeze({
      success: false as const,
      error: 'The written election must identify its new contract.',
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
      error: 'The Early Bird election recordedAt value must be a zoned ISO-8601 instant.',
      before,
    });
  }
  const event: EarlyBirdElectionEvent = Object.freeze({
    eventId: `${ledger.ledgerId}:${request.playerId}:${request.salaryCapYear}:early-bird-election:${nextStateVersion}`,
    eventVersion: 1,
    eventKind: 'early-bird-election',
    worldId: request.worldId,
    playerId: request.playerId,
    teamId: request.teamId,
    salaryCapYear: request.salaryCapYear,
    executedAt:
      recordedTime <= governedEffectiveTime
        ? request.recordedAt
        : request.asOfDate,
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
    canonLeafIds: ['CBA2-C14.9'],
    electedContractId: request.electedContractId,
    sourceRightsState: before.stateReference,
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
          : 'The Early Bird election event could not be appended.',
      before,
    });
  }
  const after = projectRightsStateAsOf({ ...request, ledger: nextLedger });
  if (
    after.status !== 'available' ||
    after.birdType !== 'Early Bird' ||
    after.signingBirdType !== 'Non-Bird'
  ) {
    return Object.freeze({
      success: false as const,
      error: 'The written election did not produce a replayable Non-Bird signing state.',
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
