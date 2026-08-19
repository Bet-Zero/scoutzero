/** Fail-closed creation and resolution of a mirrored RFA Offer Sheet lifecycle. */

import {
  GovernedOfferSheetEvidenceZ,
  GovernedOfferSheetAveragingElectionZ,
  GovernedOfferSheetLifecycleZ,
  GovernedOfferSheetProposalZ,
  type GovernedOfferSheetLifecycle,
} from '@/schemas/governedOfferSheet';
import { projectRightsStateAsOf } from '@/features/architect/utils/rightsHistory';
import { evaluateDatedSalaryLedgers } from '@/features/architect/utils/capTotals';
import { toSeasonCode } from '@/features/architect/utils/seasonFormat';
import {
  synchronizeTeamTotalsSnapshotOrTeam,
} from '@/features/architect/utils/mutationPipeline.helpers';
import { mutationSnapshotDigest } from '@/features/architect/utils/mutationPipeline.snapshotDigest';
import type {
  ArchitectMutationContract,
  ArchitectMutationOfferSheet,
  MutationOfferSheetResolutionCurrentState,
  MutationOfferSheetTeamAndPlayerCurrentState,
} from '@/features/architect/utils/mutationPipeline';
import {
  businessDaysBetween,
  compareInstant,
  exerciseNoticeDeadline,
  oneYearAfter,
  qualifyingOfferDeadlines,
  requireEasternInstant,
  worldDateContainsInstant,
} from './governedOfferSheetTime';
import { validateGovernedOfferSheetTerms } from './governedOfferSheetTerms';

type FailureStatus = 'blocked' | 'needs-input' | 'incompatible';
type Failure = { success: false; status: FailureStatus; reasons: readonly string[] };
type CreationSuccess = {
  success: true;
  lifecycle: GovernedOfferSheetLifecycle;
  receivedAt: string;
};
type ResolutionSuccess = {
  success: true;
  lifecycle: GovernedOfferSheetLifecycle;
};

function failure(status: FailureStatus, reasons: readonly string[]): Failure {
  return Object.freeze({
    success: false,
    status,
    reasons: Object.freeze([...new Set(reasons)]),
  });
}

function lifecycleFromSheet(sheet: ArchitectMutationOfferSheet | undefined) {
  return GovernedOfferSheetLifecycleZ.safeParse(sheet?.governedLifecycle);
}

function activeReservations(
  offerSheets: readonly ArchitectMutationOfferSheet[],
  season: string,
  ignoredDedupKey: string,
  reasons: string[]
): number {
  let total = 0;
  for (const sheet of offerSheets) {
    if (sheet.status !== 'PENDING_MATCH' || sheet.dedupKey === ignoredDedupKey) continue;
    const parsed = lifecycleFromSheet(sheet);
    if (!parsed.success || parsed.data.status !== 'pending-match') {
      reasons.push('An existing outstanding Offer Sheet has incompatible governed reservation data.');
      continue;
    }
    total +=
      parsed.data.reservations.offeringTeam.find((row) => row.season === season)
        ?.amount ?? 0;
  }
  return total;
}

function validateEvidenceRules(
  evidence: ReturnType<typeof GovernedOfferSheetEvidenceZ.parse>,
  signedAt: string,
  reasons: string[]
) {
  const deadlines = qualifyingOfferDeadlines(evidence.salaryCapYear);
  const qo = evidence.qualifyingOffer;
  if (qo.recordStatus !== 'current' || qo.source.recordStatus !== 'current') {
    reasons.push('The Qualifying Offer evidence is stale.');
  }
  if (evidence.league.source.recordStatus !== 'current') {
    reasons.push('The financial authority used by this Offer Sheet is stale.');
  }
  if (qo.amount !== qo.calculation.certifiedAmount) {
    reasons.push('The Qualifying Offer amount does not match its certified calculation.');
  }
  if (qo.branch === 'maximum' && qo.amount !== evidence.league.maximumSalary) {
    reasons.push('The Maximum Qualifying Offer amount does not equal the governed maximum Salary.');
  }
  if (
    (qo.branch === 'two-way') !== (qo.calculation.basis === 'two-way') ||
    (qo.calculation.basis === 'two-way' &&
      qo.calculation.twoWayQualifyingAmount !== qo.amount)
  ) {
    reasons.push('The Two-Way Qualifying Offer branch and calculation do not agree.');
  }
  if (compareInstant(qo.deliveredAt, deadlines.delivery) > 0) {
    reasons.push('The Qualifying Offer was not delivered by June 29 at 5:00 p.m. Eastern.');
  }
  if (
    compareInstant(qo.openThrough, deadlines.ordinaryOpenThrough) < 0 ||
    compareInstant(qo.openThrough, deadlines.absoluteOpenThrough) > 0
  ) {
    reasons.push('The Qualifying Offer open period is outside the October 1 through March 1 limits.');
  }
  if (compareInstant(qo.openThrough, signedAt) < 0) {
    reasons.push('The Qualifying Offer was not open when the Offer Sheet was signed.');
  }
  if (qo.withdrawnAt && compareInstant(qo.withdrawnAt, signedAt) <= 0) {
    reasons.push('The Qualifying Offer had been withdrawn before this Offer Sheet.');
  }
  if (
    qo.withdrawnAt &&
    compareInstant(qo.withdrawnAt, deadlines.consentWithdrawalStarts) >= 0 &&
    (!qo.withdrawalConsentAt || compareInstant(qo.withdrawalConsentAt, qo.withdrawnAt) > 0)
  ) {
    reasons.push('A July 14-or-later QO withdrawal lacks timely written player consent.');
  }
  if (qo.branch === 'standard' &&
      (qo.contractYears !== 1 || !qo.fullyProtected || !qo.requiredTermsPresent)) {
    reasons.push('The standard Qualifying Offer lacks its required one-year protected terms.');
  }
  if (qo.branch === 'maximum' &&
      (qo.contractYears !== 5 || qo.annualRaiseBasisPoints !== 800 ||
        !qo.fullyProtected || qo.hasOptionOrEto)) {
    reasons.push('The Maximum Qualifying Offer lacks its required five-year, 8%, fully protected, no-option terms.');
  }
  const eligibility = evidence.eligibility;
  if (
    (eligibility.category === 'first-round-year-four' &&
      !eligibility.firstRoundRookieScaleYearFourCompleted) ||
    (eligibility.category === 'qualifying-two-way' && !eligibility.qualifyingTwoWayService) ||
    (eligibility.category === 'three-or-fewer-yos' &&
      (!eligibility.otherPlayerEligible || eligibility.yearsOfService > 3))
  ) {
    reasons.push('The retained evidence does not establish an eligible RFA category.');
  }
}

export function createGovernedOfferSheetLifecycle({
  state,
  contract,
  proposalInput,
  worldId,
  salaryCapYear,
  worldAsOfDate,
  timestamp,
  offerSheetId,
  dedupKey,
}: {
  state: MutationOfferSheetTeamAndPlayerCurrentState;
  contract: ArchitectMutationContract;
  proposalInput: unknown;
  worldId: string;
  salaryCapYear: number;
  worldAsOfDate?: string | number | null;
  timestamp: number;
  offerSheetId: string;
  dedupKey: string;
}): Failure | CreationSuccess {
  const proposalParse = GovernedOfferSheetProposalZ.safeParse(proposalInput);
  if (!proposalParse.success) {
    return failure('needs-input', ['Signed Principal Terms and exact Offer Sheet notice evidence are required.']);
  }
  const evidenceInput = state.player?.rfaContext?.governedEvidence;
  const evidenceParse = GovernedOfferSheetEvidenceZ.safeParse(evidenceInput);
  if (!evidenceParse.success) {
    return failure(evidenceInput == null ? 'needs-input' : 'incompatible', [
      'Authenticated RFA and Qualifying Offer evidence is missing or malformed.',
    ]);
  }
  const proposal = proposalParse.data;
  const evidence = evidenceParse.data;
  if (evidence.status === 'unknown') {
    return failure('needs-input', [
      'Authenticated RFA and Qualifying Offer evidence is incomplete.',
    ]);
  }
  if (evidence.status === 'conflicting') {
    return failure('incompatible', [
      'Authenticated RFA and Qualifying Offer evidence conflicts.',
    ]);
  }
  const reasons: string[] = [];
  const signedAt = requireEasternInstant(proposal.signedAt, 'Offer Sheet signing', reasons);
  const receivedAt = requireEasternInstant(proposal.receivedAt, 'Offer Sheet receipt', reasons);
  if (!signedAt || !receivedAt) return failure('blocked', reasons);
  if (!worldDateContainsInstant(worldAsOfDate, signedAt)) {
    reasons.push('The signed Offer Sheet instant does not match the governed Team Plan date.');
  }
  if (compareInstant(signedAt, receivedAt) > 0) {
    reasons.push('The Offer Sheet cannot be received before it is signed.');
  }
  if (compareInstant(signedAt, qualifyingOfferDeadlines(salaryCapYear).offerSheetLastSignedAt) > 0) {
    reasons.push('The ordinary March 1 Offer Sheet signing deadline has passed.');
  }
  if (
    evidence.worldId !== worldId ||
    evidence.homeTeamId !== state.homeTeam?.teamCode ||
    evidence.playerId !== state.player?.player_id && evidence.playerId !== state.player?.id ||
    evidence.salaryCapYear !== salaryCapYear
  ) {
    reasons.push('RFA/QO evidence does not match this world, home Team, player, and Salary Cap Year.');
  }
  if (compareInstant(evidence.observedAt, signedAt) > 0 ||
      compareInstant(evidence.qualifyingOffer.source.retrievedAt, signedAt) > 0 ||
      compareInstant(evidence.league.source.retrievedAt, signedAt) > 0) {
    reasons.push('Offer Sheet authority was observed after the transaction instant.');
  }
  validateEvidenceRules(evidence, signedAt, reasons);
  const rights = projectRightsStateAsOf({
    ledger: state.homeTeam?.rightsLedger,
    worldId,
    teamId: String(state.homeTeam?.teamCode || ''),
    playerId: evidence.playerId,
    // Rights authority is date-granular; the Offer Sheet notice remains exact.
    // Do not promote date-only rights events to an invented midnight instant.
    asOfDate: signedAt.slice(0, 10),
    salaryCapYear,
  });
  if (rights.status !== 'available' || rights.freeAgentStatus !== 'RFA' || rights.rightOfFirstRefusal !== 'active') {
    reasons.push(...(rights.reasons.length ? rights.reasons : ['The home Team has no active governed Right of First Refusal.']));
  }
  const termResult = validateGovernedOfferSheetTerms({ proposal, evidence, contract });
  reasons.push(...termResult.reasons);
  const existing = [...(state.team?.offerSheets ?? []), ...(state.homeTeam?.incomingOfferSheets ?? [])]
    .filter((sheet) => sheet.status === 'PENDING_MATCH' && String(sheet.playerId) === evidence.playerId);
  for (const sheet of existing) {
    if (sheet.dedupKey !== dedupKey) reasons.push('The player already has another outstanding Offer Sheet.');
    else {
      const parsed = lifecycleFromSheet(sheet);
      const root = parsed.success ? parsed.data.events[0] : null;
      if (!parsed.success || root?.eventKind !== 'offer-sheet-signed' || JSON.stringify(root.proposal) !== JSON.stringify(proposal)) {
        reasons.push('An idempotent Offer Sheet retry changed its signed Principal Terms.');
      } else if (reasons.length === 0) {
        return { success: true, lifecycle: parsed.data, receivedAt };
      }
    }
  }
  const season = toSeasonCode(salaryCapYear);
  const currentReservation = termResult.offeringReservations.find((row) => row.season === season)?.amount;
  if (currentReservation == null) reasons.push(`Principal Terms do not include ${season}.`);
  activeReservations(state.team?.offerSheets ?? [], season, dedupKey, reasons);
  const totals = state.team ? synchronizeTeamTotalsSnapshotOrTeam(state.team, salaryCapYear).totals : null;
  const allocations = Number(totals?.totalCapAllocations);
  const teamCode = String(state.team?.teamCode || '');
  const teamStateReference = state.team
    ? `${worldId}:${teamCode}:${mutationSnapshotDigest(state.team)}`
    : '';
  const salaryEvaluation = evaluateDatedSalaryLedgers({
    context: {
      asOfDate: signedAt,
      salaryCapYear,
      team: { teamId: teamCode, teamCode },
    },
    ledgers: {
      teamSalary: Number.isFinite(allocations)
        ? {
            status: 'ready',
            lineItems: [
              {
                id: `pre-offer-sheet-team-salary:${teamCode}:${salaryCapYear}`,
                ledger: 'team-salary',
                label: 'Pre-Offer-Sheet Team Salary',
                amount: allocations,
                effectiveFrom: `${salaryCapYear - 1}-07-01T00:00:00-04:00`,
                canonLeafIds: ['CBA2-L04.3'],
                source: {
                  authority: 'team-state',
                  reference: teamStateReference,
                },
              },
            ],
          }
        : {
            status: 'needs-input',
            missingInputs: ['ledgers.teamSalary.lineItems'],
            reason: 'Offering Team Salary cannot be resolved.',
          },
      apronTeamSalary: {
        status: 'not-evaluated',
        reason: 'Offer Sheet Room does not use Apron Team Salary.',
      },
      taxSalary: {
        status: 'not-evaluated',
        reason: 'Offer Sheet Room does not use Tax Salary.',
      },
    },
  });
  const governedTeamSalary = salaryEvaluation.ledgers.teamSalary;
  if (governedTeamSalary.status !== 'complete' || governedTeamSalary.total == null) {
    reasons.push('Offering Team Salary cannot be resolved on the governed transaction date.');
  } else if (
    (currentReservation ?? 0) >
    evidence.league.salaryCap - governedTeamSalary.total
  ) {
    reasons.push('The offering Team does not preserve sufficient governed Room for this Offer Sheet.');
  }
  if (reasons.length > 0 || !rights.ledgerReference || !rights.stateReference) return failure('blocked', reasons);
  const recordedAt = new Date(timestamp).toISOString();
  const lifecycle: GovernedOfferSheetLifecycle = {
    payloadVersion: 1,
    ledgerId: `offer-sheet-ledger:${worldId}:${offerSheetId}`,
    ledgerVersion: 1,
    worldId,
    playerId: evidence.playerId,
    homeTeamId: evidence.homeTeamId,
    offeringTeamId: teamCode,
    salaryCapYear,
    status: 'pending-match',
    evidenceReference: { evidenceId: evidence.evidenceId, evidenceRecordVersion: evidence.evidenceRecordVersion },
    evidenceSnapshot: evidence,
    rightsReference: { ...rights.ledgerReference, ...rights.stateReference },
    reservations: {
      offeringTeam: [...termResult.offeringReservations],
      offeringTeamSalaryReference: {
        ledgerKind: 'team-salary',
        asOfDate: signedAt,
        salaryCap: evidence.league.salaryCap,
        totalBeforeOfferSheet: governedTeamSalary.total ?? 0,
        teamStateReference,
        canonLeafIds: ['CBA2-L04.3'],
      },
      homeTeamAuthority: 'right-of-first-refusal',
      arenasApplies: termResult.isArenas,
      offeringTeamAccounting: termResult.isArenas ? 'average-annual-salary' : 'stated-schedule',
      homeTeamAccounting: 'stated-schedule',
    },
    events: [{
      eventKind: 'offer-sheet-signed',
      eventId: `${offerSheetId}:signed:v1`,
      eventVersion: 1,
      executedAt: signedAt,
      recordedAt,
      qualifyingOfferId: evidence.qualifyingOffer.offerId,
      qualifyingOfferVersion: evidence.qualifyingOffer.offerVersion,
      exerciseNoticeDeadline: exerciseNoticeDeadline(receivedAt),
      proposal,
    }],
  };
  const verified = GovernedOfferSheetLifecycleZ.safeParse(lifecycle);
  return verified.success ? { success: true, lifecycle: verified.data, receivedAt } : failure('incompatible', ['The governed Offer Sheet lifecycle could not be certified.']);
}

export function resolveGovernedOfferSheetLifecycle({
  state,
  action,
  resolutionAt,
  averagingElectionInput,
  timestamp,
}: {
  state: MutationOfferSheetResolutionCurrentState;
  action: 'match' | 'decline';
  resolutionAt?: string | number | null;
  averagingElectionInput?: unknown;
  timestamp: number;
}): Failure | ResolutionSuccess {
  const homeSheet = state.homeTeam?.incomingOfferSheets?.find((sheet) => String(sheet.id) === state.offerSheetId);
  const offeringSheet = state.offeringTeam?.offerSheets?.find((sheet) => String(sheet.id) === state.offerSheetId);
  const home = lifecycleFromSheet(homeSheet);
  const offering = lifecycleFromSheet(offeringSheet);
  if (!home.success || !offering.success) return failure('incompatible', ['Both Team mirrors require a readable governed Offer Sheet lifecycle.']);
  if (JSON.stringify(home.data) !== JSON.stringify(offering.data)) return failure('incompatible', ['The two Team Offer Sheet lifecycle mirrors disagree.']);
  const lifecycle = home.data;
  if (lifecycle.status !== 'pending-match') return failure('blocked', ['Only a pending Offer Sheet can be resolved.']);
  const reasons: string[] = [];
  const exactAt = requireEasternInstant(resolutionAt, 'Offer Sheet resolution', reasons);
  if (!exactAt) return failure('needs-input', reasons);
  const signedEvent = lifecycle.events[0];
  if (signedEvent.eventKind !== 'offer-sheet-signed') return failure('incompatible', ['The lifecycle has no signed Offer Sheet root event.']);
  if (action === 'match' && compareInstant(exactAt, signedEvent.exerciseNoticeDeadline) > 0) {
    reasons.push('The exact Exercise Notice deadline has passed.');
  }
  const electionParse =
    averagingElectionInput == null
      ? null
      : GovernedOfferSheetAveragingElectionZ.safeParse(averagingElectionInput);
  if (electionParse && !electionParse.success) {
    return failure('needs-input', [
      'The averaging election requires its written statement and exact NBA receipt and Players Association relay times.',
    ]);
  }
  const election = electionParse?.success ? electionParse.data : null;
  if (action === 'decline' && election) {
    reasons.push('An averaging election can accompany only an Exercise Notice.');
  }
  if (election) {
    if (!lifecycle.reservations.arenasApplies) reasons.push('Only an Arenas match may elect Average Annual Salary.');
    if (compareInstant(election.deliveredToNbaAt, exactAt) !== 0) reasons.push('The averaging election was not delivered with the Exercise Notice.');
    if (
      compareInstant(election.relayedToPlayersAssociationAt, election.deliveredToNbaAt) < 0 ||
      businessDaysBetween(
        election.deliveredToNbaAt,
        election.relayedToPlayersAssociationAt
      ) > 1
    ) reasons.push('The averaging-election statement was not relayed within one business day.');
  }
  if (reasons.length > 0) return failure('blocked', reasons);
  const version = lifecycle.ledgerVersion + 1;
  const recordedAt = new Date(timestamp).toISOString();
  const next: GovernedOfferSheetLifecycle = {
    ...lifecycle,
    ledgerVersion: version,
    status: action === 'match' ? 'matched' : 'declined',
    reservations: {
      ...lifecycle.reservations,
      homeTeamAccounting: action === 'match' && election ? 'average-annual-salary' : 'stated-schedule',
    },
    events: [
      ...lifecycle.events,
      action === 'match'
        ? {
            eventKind: 'offer-sheet-matched',
            eventId: `${lifecycle.ledgerId}:matched:v${version}`,
            eventVersion: 1,
            executedAt: exactAt,
            recordedAt,
            restrictionsUntil: oneYearAfter(exactAt),
            playerTradeConsentRequired: true,
            offeringTeamTradeBarred: true,
            signAndTradeBarred: true,
            averagingElection: election,
          }
        : {
            eventKind: 'offer-sheet-declined',
            eventId: `${lifecycle.ledgerId}:declined:v${version}`,
            eventVersion: 1,
            executedAt: exactAt,
            recordedAt,
          },
    ],
  };
  const parsed = GovernedOfferSheetLifecycleZ.safeParse(next);
  return parsed.success ? { success: true, lifecycle: parsed.data } : failure('incompatible', ['The resolved Offer Sheet lifecycle could not be certified.']);
}
