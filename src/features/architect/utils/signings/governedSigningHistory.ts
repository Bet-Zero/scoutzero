import {
  ContractEventRecordZ,
  type ContractEventLedgerPayload,
} from '@/schemas/contractEventLedger';
import {
  GovernedContractStateZ,
  type ContractTemporalValue,
  type GovernedContractState,
} from '@/schemas/governedContractState';
import {
  createContractEventLedger,
  toContractEventLedgerPayload,
} from '@/features/architect/utils/contractHistory';
import { deterministicStateDigest } from '@/features/architect/utils/contractSource/deterministicDigest';
import {
  isDateOnly,
  isZonedDateTime,
} from '@/features/architect/utils/governedSeason/governedTime';
import type { ArchitectMutationContract } from '@/features/architect/utils/mutationPipeline.types';
import type { GovernedSigningAuthority } from './governedSigningAuthority';

const dateValue = (value: unknown): ContractTemporalValue =>
  typeof value === 'string' && isDateOnly(value)
    ? { precision: 'date', value, rawValue: value }
    : typeof value === 'string' && isZonedDateTime(value)
      ? { precision: 'instant', value, rawValue: value }
      : { precision: 'unknown', value: null, rawValue: null };

const numberValue = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;
const integerValue = (value: unknown): number | null =>
  typeof value === 'number' && Number.isInteger(value) ? value : null;
const stringValue = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value : null;
const booleanValue = (value: unknown): boolean | null =>
  typeof value === 'boolean' ? value : null;

function authoredState({
  contract,
  contractId,
  playerId,
  teamId,
  operationId,
  authoringIdentity,
  recordedAt,
  authority,
}: GovernedSigningHistoryRequest): GovernedContractState {
  const bird = contract.birdRights || {};
  const freeAgency =
    contract.freeAgency && typeof contract.freeAgency === 'object'
      ? contract.freeAgency
      : {};
  const stateWithoutDigest: Omit<GovernedContractState, 'stateDigest'> = {
    stateVersion: 1,
    contractId: contractId!,
    contractVersion: 1,
    playerId,
    teamId,
    establishmentKind: 'signing',
    terms: {
      contractType: stringValue(contract.contractType),
      isExtension: booleanValue(contract.isExtension),
      isRookieScale: booleanValue(contract.isRookieScale),
      signedUsing: stringValue(contract.signedUsing || contract.exceptionType),
      signingTeam: teamId,
      signingDate: dateValue(authority.worldDate),
      signingExecutive: stringValue(contract.signingExecutive),
      signedByCurrentTeam: booleanValue(contract.signedByCurrentTeam),
      startSeason: stringValue(contract.startSeason) || authority.seasonKey,
      endSeason:
        stringValue(contract.endSeason) ||
        contract.salariesByYear?.at(-1)?.season ||
        null,
      contractLength: integerValue(
        contract.contractLength ?? contract.contractYears ?? contract.years
      ),
      totalValue: numberValue(contract.totalValue),
      averageAnnualValue: numberValue(contract.averageAnnualValue),
      guaranteedValue: numberValue(contract.guaranteedValue),
      guaranteedYears: integerValue(contract.guaranteedYears),
      salaries: (contract.salariesByYear || []).map((row) => ({
        season: stringValue(row.season),
        salary: numberValue(row.salary),
        capHit: numberValue(row.capHit),
        guaranteed: booleanValue(row.guaranteed),
        guaranteedAmount: numberValue(row.guaranteedAmount),
        option:
          row.option === 'PO' || row.option === 'TO' || row.option === 'ETO'
            ? row.option
            : null,
        optionHolder:
          row.option === 'TO'
            ? 'team'
            : row.option === 'PO' || row.option === 'ETO'
              ? 'player'
              : null,
        optionUsed: booleanValue(row.optionUsed),
        optionDecisionDate: dateValue(row.optionDecisionDate),
        optionDecisionDeadline: dateValue(null),
        tradeBonus: numberValue(row.tradeBonus),
        incentives: {
          likely: numberValue(row.incentives?.likely),
          unlikely: numberValue(row.incentives?.unlikely),
          criteriaEvidence: 'unsupported',
        },
        guaranteeSchedule: (row.guaranteeSchedule || []).map((step) => ({
          effectiveDate: dateValue(step.effectiveDate),
          guaranteedAmount: numberValue(step.guaranteedAmount),
          status: stringValue(step.status),
          note: typeof step.note === 'string' ? step.note : null,
        })),
        voidedByExtension: booleanValue(row.voidedByExtension),
        voidedOn: dateValue(row.voidedOn),
      })),
      bonuses: { tradeKickerPercent: numberValue(contract.tradeKicker) },
      restrictions: {
        noTradeClause: booleanValue(contract.noTradeClause),
        tradeRestrictions: Array.isArray(contract.tradeRestrictions)
          ? contract.tradeRestrictions
          : [],
        canBeTradedNow: booleanValue(contract.tradeEligibility?.canBeTradedNow),
        restrictedUntil: dateValue(contract.tradeEligibility?.restrictedUntil),
        reason: stringValue(contract.tradeEligibility?.reason),
        baseYearCompensation: booleanValue(
          contract.tradeEligibility?.rules?.baseYearCompensation
        ),
        poisonPill: booleanValue(contract.tradeEligibility?.rules?.poisonPill),
        aggregation: booleanValue(
          contract.tradeEligibility?.rules?.aggregation
        ),
      },
      birdRights: {
        status: stringValue(bird.status || bird.type),
        yearsOfService: integerValue(bird.yearsOfService),
        yearsWithTeam: integerValue(bird.yearsWithTeam),
        eligibleFor: Array.isArray(bird.eligibleFor) ? bird.eligibleFor : [],
      },
      freeAgency: {
        type: stringValue(freeAgency.type),
        year: integerValue(freeAgency.year),
        capHold: numberValue(freeAgency.capHold),
        qualifyingOffer: numberValue(freeAgency.qualifyingOffer),
        earlyTerminationOption:
          typeof freeAgency.earlyTerminationOption === 'string'
            ? freeAgency.earlyTerminationOption
            : null,
        hasOption: booleanValue(freeAgency.hasOption),
        optionYear: stringValue(freeAgency.optionYear),
        optionType: stringValue(freeAgency.optionType),
      },
      sourceLimitations: [
        'Salary-only Architect authoring does not establish a signing bonus under CBA2-C23.6.',
      ],
    },
    evidence: [],
    completeness: { status: 'complete', reasons: [] },
    source: {
      sourceKind: 'saved-world-signing',
      operationId,
      authoringIdentity,
      recordedAt: dateValue(recordedAt),
      worldAsOfDate: dateValue(authority.worldDate),
    },
  };
  return GovernedContractStateZ.parse({
    ...stateWithoutDigest,
    stateDigest: deterministicStateDigest(stateWithoutDigest),
  });
}

export type GovernedSigningHistoryRequest = {
  contract: ArchitectMutationContract;
  playerId: string;
  teamId: string;
  worldId: string;
  operationId: string;
  authoringIdentity: string;
  recordedAt: string;
  authority: GovernedSigningAuthority;
  contractId?: string;
};

export function buildGovernedSigningHistory(
  request: GovernedSigningHistoryRequest
): { contractId: string; eventId: string; ledger: ContractEventLedgerPayload } {
  const contractId =
    request.contractId || `${request.worldId}:${request.operationId}:contract`;
  const eventId = `${request.operationId}:signing`;
  const resultingState = authoredState({ ...request, contractId });
  const event = ContractEventRecordZ.parse({
    eventId,
    eventVersion: 1,
    eventKind: 'signing',
    worldId: request.worldId,
    contractId,
    playerId: request.playerId,
    teamId: request.teamId,
    executedAt: request.authority.effectiveAt,
    effectiveAt: request.authority.effectiveAt,
    recordedAt: request.recordedAt,
    predecessorContractVersion: null,
    resultingContractVersion: 1,
    predecessorEventId: null,
    sourceTransactionId: request.operationId,
    authoringIdentity: request.authoringIdentity,
    recordStatus: 'current',
    supersedesEventVersion: null,
    canonLeafIds: request.authority.canonLeafIds,
    resultingState,
  });
  const ledger = createContractEventLedger({
    ledgerId: `${request.worldId}:${contractId}:contract`,
    ledgerVersion: 1,
    events: [event],
  });
  return { contractId, eventId, ledger: toContractEventLedgerPayload(ledger) };
}
