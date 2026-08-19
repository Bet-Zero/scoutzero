/** Fail-closed creation and resolution of a mirrored RFA Offer Sheet lifecycle. */

import {
  GovernedOfferSheetEvidenceZ,
  GovernedOfferSheetAveragingElectionZ,
  GovernedOfferSheetLifecycleZ,
  GovernedOfferSheetProposalZ,
  type GovernedOfferSheetLifecycle,
  type GovernedOfferSheetTeamSalaryReference,
} from '@/schemas/governedOfferSheet';
import { projectRightsStateAsOf } from '@/features/architect/utils/rightsHistory';
import { evaluateDatedSalaryLedgers } from '@/features/architect/utils/capTotals';
import { toSeasonCode } from '@/features/architect/utils/seasonFormat';
import { synchronizeTeamTotalsSnapshotOrTeam } from '@/features/architect/utils/mutationPipeline.helpers';
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
  worldDateHasReachedInstant,
} from './governedOfferSheetTime';
import { validateGovernedOfferSheetTerms } from './governedOfferSheetTerms';

type FailureStatus = 'blocked' | 'needs-input' | 'incompatible';
type Failure = {
  success: false;
  status: FailureStatus;
  reasons: readonly string[];
};
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
    if (sheet.status !== 'PENDING_MATCH' || sheet.dedupKey === ignoredDedupKey)
      continue;
    const parsed = lifecycleFromSheet(sheet);
    if (!parsed.success || parsed.data.status !== 'pending-match') {
      reasons.push(
        'An existing outstanding Offer Sheet has incompatible governed reservation data.'
      );
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
  requireEasternInstant(qo.deliveredAt, 'Qualifying Offer delivery', reasons);
  requireEasternInstant(
    qo.openThrough,
    'Qualifying Offer open-through time',
    reasons
  );
  if (qo.withdrawnAt) {
    requireEasternInstant(
      qo.withdrawnAt,
      'Qualifying Offer withdrawal',
      reasons
    );
  }
  if (qo.withdrawalConsentAt) {
    requireEasternInstant(
      qo.withdrawalConsentAt,
      'Qualifying Offer withdrawal consent',
      reasons
    );
  }
  if (qo.recordStatus !== 'current' || qo.source.recordStatus !== 'current') {
    reasons.push('The Qualifying Offer evidence is stale.');
  }
  if (evidence.league.source.recordStatus !== 'current') {
    reasons.push('The financial authority used by this Offer Sheet is stale.');
  }
  if (qo.amount !== qo.calculation.certifiedAmount) {
    reasons.push(
      'The Qualifying Offer amount does not match its certified calculation.'
    );
  }
  if (
    qo.annualBaseSchedule.length !== qo.contractYears ||
    qo.annualBaseSchedule[0] !== qo.amount
  ) {
    reasons.push(
      'The Qualifying Offer annual Base schedule does not match its term and first-year amount.'
    );
  }
  if (qo.calculation.calculationYear !== evidence.salaryCapYear) {
    reasons.push(
      'The Qualifying Offer calculation uses the wrong Salary Cap Year.'
    );
  }
  const calculationHasRequiredInputs =
    (qo.calculation.basis === 'draft-slot' &&
      qo.calculation.draftSlot != null &&
      qo.calculation.draftSlotAmount != null) ||
    (qo.calculation.basis === 'prior-salary' &&
      qo.calculation.priorSalary != null) ||
    (qo.calculation.basis === 'starter-criteria' &&
      qo.calculation.officialStarts != null &&
      qo.calculation.officialMinutes != null &&
      qo.calculation.starterStartsThreshold != null &&
      qo.calculation.starterMinutesThreshold != null &&
      qo.calculation.starterCriteriaAmount != null &&
      (qo.calculation.officialStarts >= qo.calculation.starterStartsThreshold ||
        qo.calculation.officialMinutes >=
          qo.calculation.starterMinutesThreshold)) ||
    (qo.calculation.basis === 'two-way' &&
      qo.calculation.twoWayQualifyingAmount != null);
  if (!calculationHasRequiredInputs) {
    reasons.push(
      'The Qualifying Offer calculation lacks its draft-slot, prior-Salary, starter, or Two-Way inputs.'
    );
  }
  if (qo.branch === 'maximum' && qo.amount !== evidence.league.maximumSalary) {
    reasons.push(
      'The Maximum Qualifying Offer amount does not equal the governed maximum Salary.'
    );
  }
  if (
    (qo.branch === 'two-way') !== (qo.calculation.basis === 'two-way') ||
    (qo.calculation.basis === 'two-way' &&
      qo.calculation.twoWayQualifyingAmount !== qo.amount)
  ) {
    reasons.push(
      'The Two-Way Qualifying Offer branch and calculation do not agree.'
    );
  }
  if (compareInstant(qo.deliveredAt, deadlines.delivery) > 0) {
    reasons.push(
      'The Qualifying Offer was not delivered by June 29 at 5:00 p.m. Eastern.'
    );
  }
  if (
    compareInstant(qo.openThrough, deadlines.ordinaryOpenThrough) < 0 ||
    compareInstant(qo.openThrough, deadlines.absoluteOpenThrough) > 0
  ) {
    reasons.push(
      'The Qualifying Offer open period is outside the October 1 through March 1 limits.'
    );
  }
  if (
    compareInstant(qo.openThrough, deadlines.ordinaryOpenThrough) > 0 &&
    !qo.extensionDocumentId
  ) {
    reasons.push(
      'A Qualifying Offer kept open after October 1 lacks its written extension record.'
    );
  }
  if (compareInstant(qo.openThrough, signedAt) < 0) {
    reasons.push(
      'The Qualifying Offer was not open when the Offer Sheet was signed.'
    );
  }
  if (qo.withdrawnAt && compareInstant(qo.withdrawnAt, signedAt) <= 0) {
    reasons.push(
      'The Qualifying Offer had been withdrawn before this Offer Sheet.'
    );
  }
  if (
    qo.withdrawnAt &&
    compareInstant(qo.withdrawnAt, deadlines.consentWithdrawalStarts) >= 0 &&
    (!qo.withdrawalConsentAt ||
      !qo.withdrawalConsentDocumentId ||
      compareInstant(qo.withdrawalConsentAt, qo.withdrawnAt) > 0)
  ) {
    reasons.push(
      'A July 14-or-later QO withdrawal lacks timely written player consent.'
    );
  }
  if (
    qo.branch === 'standard' &&
    (qo.contractYears !== 1 ||
      !qo.fullyProtected ||
      !qo.requiredTermsPresent ||
      qo.hasOptionOrEto)
  ) {
    reasons.push(
      'The standard Qualifying Offer lacks its required one-year protected terms.'
    );
  }
  if (
    qo.branch === 'maximum' &&
    (qo.contractYears !== 5 ||
      qo.annualRaiseBasisPoints !== 800 ||
      !qo.fullyProtected ||
      !qo.requiredTermsPresent ||
      qo.hasOptionOrEto)
  ) {
    reasons.push(
      'The Maximum Qualifying Offer lacks its required five-year, 8%, fully protected, no-option terms.'
    );
  }
  if (
    qo.branch === 'maximum' &&
    qo.annualBaseSchedule.some(
      (amount, index) => amount !== Math.round(qo.amount * (1 + index * 0.08))
    )
  ) {
    reasons.push(
      'The Maximum Qualifying Offer annual Base schedule does not use 8% of first-year Base.'
    );
  }
  if (
    qo.branch === 'two-way' &&
    (qo.contractYears !== 1 ||
      qo.annualBaseSchedule.length !== 1 ||
      !qo.requiredTermsPresent ||
      qo.hasOptionOrEto)
  ) {
    reasons.push(
      'The Two-Way Qualifying Offer lacks its separate one-year form and terms.'
    );
  }
  const eligibility = evidence.eligibility;
  if (
    (eligibility.category === 'first-round-year-four' &&
      (!eligibility.firstRoundRookieScaleYearFourCompleted ||
        eligibility.yearsOfService !== 4)) ||
    (eligibility.category === 'qualifying-two-way' &&
      !eligibility.qualifyingTwoWayService) ||
    (eligibility.category === 'three-or-fewer-yos' &&
      (!eligibility.otherPlayerEligible || eligibility.yearsOfService > 3))
  ) {
    reasons.push(
      'The retained evidence does not establish an eligible RFA category.'
    );
  }
  if (
    eligibility.firstRoundRookieScaleYearFourCompleted !==
      (eligibility.category === 'first-round-year-four') ||
    eligibility.qualifyingTwoWayService !==
      (eligibility.category === 'qualifying-two-way') ||
    eligibility.otherPlayerEligible !==
      (eligibility.category === 'three-or-fewer-yos')
  ) {
    reasons.push(
      'The retained RFA category evidence is internally conflicting.'
    );
  }
  if (
    (eligibility.category === 'qualifying-two-way') !==
    (qo.branch === 'two-way')
  ) {
    reasons.push(
      'The qualifying Two-Way category and Qualifying Offer branch do not agree.'
    );
  }
  if (
    evidence.league.arenasYearOneMaximum !== evidence.league.nonTaxpayerMle ||
    evidence.league.arenasYearTwoMaximum !==
      Math.round(evidence.league.arenasYearOneMaximum * 1.05 * 100) / 100
  ) {
    reasons.push('The governed Arenas first-two-year maximums conflict.');
  }
  if (
    evidence.league.maximumSalaryBySeason.find(
      (row) => row.season === toSeasonCode(evidence.salaryCapYear)
    )?.amount !== evidence.league.maximumSalary
  ) {
    reasons.push(
      'The governed current-year maximum Salary authorities conflict.'
    );
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
    return failure('needs-input', [
      'Signed Principal Terms and exact Offer Sheet notice evidence are required.',
    ]);
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
  const signedAt = requireEasternInstant(
    proposal.signedAt,
    'Offer Sheet signing',
    reasons
  );
  const receivedAt = requireEasternInstant(
    proposal.receivedAt,
    'Offer Sheet receipt',
    reasons
  );
  if (!signedAt || !receivedAt) return failure('blocked', reasons);
  if (!worldDateContainsInstant(worldAsOfDate, signedAt)) {
    reasons.push(
      'The signed Offer Sheet instant does not match the governed Team Plan date.'
    );
  }
  if (!worldDateContainsInstant(worldAsOfDate, receivedAt)) {
    reasons.push(
      'The Offer Sheet receipt instant does not match the governed Team Plan date.'
    );
  }
  if (compareInstant(signedAt, receivedAt) > 0) {
    reasons.push('The Offer Sheet cannot be received before it is signed.');
  }
  if (
    compareInstant(
      signedAt,
      qualifyingOfferDeadlines(salaryCapYear).offerSheetLastSignedAt
    ) > 0
  ) {
    reasons.push(
      'The ordinary March 1 Offer Sheet signing deadline has passed.'
    );
  }
  if (
    evidence.worldId !== worldId ||
    evidence.homeTeamId !== state.homeTeam?.teamCode ||
    (evidence.playerId !== state.player?.player_id &&
      evidence.playerId !== state.player?.id) ||
    evidence.salaryCapYear !== salaryCapYear
  ) {
    reasons.push(
      'RFA/QO evidence does not match this world, home Team, player, and Salary Cap Year.'
    );
  }
  if (
    compareInstant(evidence.observedAt, signedAt) > 0 ||
    compareInstant(evidence.qualifyingOffer.source.retrievedAt, signedAt) > 0 ||
    compareInstant(evidence.league.source.retrievedAt, signedAt) > 0
  ) {
    reasons.push(
      'Offer Sheet authority was observed after the transaction instant.'
    );
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
  if (
    rights.status !== 'available' ||
    rights.freeAgentStatus !== 'RFA' ||
    rights.rightOfFirstRefusal !== 'active'
  ) {
    reasons.push(
      ...(rights.reasons.length
        ? rights.reasons
        : ['The home Team has no active governed Right of First Refusal.'])
    );
  }
  const termResult = validateGovernedOfferSheetTerms({
    proposal,
    evidence,
    contract,
  });
  reasons.push(...termResult.reasons);
  const exerciseDeadline = exerciseNoticeDeadline(receivedAt);
  const matchingAuthority = evidence.homeTeamMatchingAuthority;
  if (
    matchingAuthority.recordStatus !== 'current' ||
    matchingAuthority.source.recordStatus !== 'current'
  ) {
    reasons.push('The home Team matching authority is stale.');
  }
  if (
    compareInstant(matchingAuthority.source.retrievedAt, signedAt) > 0 ||
    compareInstant(matchingAuthority.effectiveFrom, signedAt) > 0 ||
    compareInstant(matchingAuthority.effectiveThrough, exerciseDeadline) < 0
  ) {
    reasons.push(
      'The home Team did not preserve matching authority throughout the Exercise Notice period.'
    );
  }
  if (matchingAuthority.amount < termResult.firstYearMatchAmount) {
    reasons.push(
      'The home Team matching authority is insufficient for the signed Principal Terms.'
    );
  }
  const existingOffering = (state.team?.offerSheets ?? []).filter(
    (sheet) =>
      sheet.status === 'PENDING_MATCH' &&
      String(sheet.playerId) === evidence.playerId
  );
  const existingHome = (state.homeTeam?.incomingOfferSheets ?? []).filter(
    (sheet) =>
      sheet.status === 'PENDING_MATCH' &&
      String(sheet.playerId) === evidence.playerId
  );
  const existing = [...existingOffering, ...existingHome];
  if (existing.some((sheet) => sheet.dedupKey !== dedupKey)) {
    reasons.push('The player already has another outstanding Offer Sheet.');
  } else if (existing.length > 0) {
    if (existingOffering.length !== 1 || existingHome.length !== 1) {
      reasons.push(
        'An idempotent Offer Sheet retry requires exactly one readable mirror on each Team.'
      );
    }
    const parsed = existing.map(lifecycleFromSheet);
    const roots = parsed.map((entry) =>
      entry.success ? entry.data.events[0] : null
    );
    if (
      parsed.some((entry) => !entry.success) ||
      roots.some(
        (root) =>
          root?.eventKind !== 'offer-sheet-signed' ||
          JSON.stringify(root.proposal) !== JSON.stringify(proposal)
      ) ||
      (parsed[0]?.success &&
        parsed[1]?.success &&
        JSON.stringify(parsed[0].data) !== JSON.stringify(parsed[1].data))
    ) {
      reasons.push(
        'An idempotent Offer Sheet retry changed its signed Principal Terms or mirrored lifecycle.'
      );
    } else if (reasons.length === 0 && parsed[0]?.success) {
      return { success: true, lifecycle: parsed[0].data, receivedAt };
    }
  }
  const season = toSeasonCode(salaryCapYear);
  const currentReservation = termResult.offeringReservations.find(
    (row) => row.season === season
  )?.amount;
  if (currentReservation == null)
    reasons.push(`Principal Terms do not include ${season}.`);
  const outstandingReservations = activeReservations(
    state.team?.offerSheets ?? [],
    season,
    dedupKey,
    reasons
  );
  const totals = state.team
    ? synchronizeTeamTotalsSnapshotOrTeam(state.team, salaryCapYear).totals
    : null;
  const allocations = Number(totals?.totalCapAllocations);
  const snapshotOutstandingReservations = Number(
    totals?.outstandingOfferSheetTotal
  );
  if (
    Number.isFinite(snapshotOutstandingReservations) &&
    snapshotOutstandingReservations !== outstandingReservations
  ) {
    reasons.push(
      'Outstanding Offer Sheet reservations do not reconcile with governed Team Salary.'
    );
  }
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
  if (
    governedTeamSalary.status !== 'complete' ||
    governedTeamSalary.total == null
  ) {
    reasons.push(
      'Offering Team Salary cannot be resolved on the governed transaction date.'
    );
  } else if (
    // governedTeamSalary.total already includes every outstanding Offer Sheet
    // reservation. Add only the new sheet here so existing Room is not counted
    // twice.
    (currentReservation ?? 0) >
    evidence.league.salaryCap - governedTeamSalary.total
  ) {
    reasons.push(
      'The offering Team does not preserve sufficient governed Room for this Offer Sheet.'
    );
  }
  if (!rights.ledgerReference || !rights.stateReference) {
    return failure('blocked', [
      ...reasons,
      'The authenticated RFA rights ledger and projected state references are required.',
    ]);
  }
  if (reasons.length > 0) return failure('blocked', reasons);
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
    evidenceReference: {
      evidenceId: evidence.evidenceId,
      evidenceRecordVersion: evidence.evidenceRecordVersion,
    },
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
      homeTeamAuthority: matchingAuthority.kind,
      arenasApplies: termResult.isArenas,
      offeringTeamAccounting: termResult.isArenas
        ? 'average-annual-salary'
        : 'stated-schedule',
      homeTeamAccounting: 'stated-schedule',
    },
    events: [
      {
        eventKind: 'offer-sheet-signed',
        eventId: `${offerSheetId}:signed:v1`,
        eventVersion: 1,
        executedAt: signedAt,
        recordedAt,
        qualifyingOfferId: evidence.qualifyingOffer.offerId,
        qualifyingOfferVersion: evidence.qualifyingOffer.offerVersion,
        exerciseNoticeDeadline: exerciseDeadline,
        proposal,
      },
    ],
  };
  const verified = GovernedOfferSheetLifecycleZ.safeParse(lifecycle);
  return verified.success
    ? { success: true, lifecycle: verified.data, receivedAt }
    : failure('incompatible', [
        'The governed Offer Sheet lifecycle could not be certified.',
      ]);
}

export function resolveGovernedOfferSheetLifecycle({
  state,
  action,
  dedupKey,
  resolutionAt,
  worldAsOfDate,
  averagingElectionInput,
  timestamp,
}: {
  state: MutationOfferSheetResolutionCurrentState;
  action: 'match' | 'decline';
  dedupKey?: string | null;
  resolutionAt?: string | number | null;
  worldAsOfDate?: string | number | null;
  averagingElectionInput?: unknown;
  timestamp: number;
}): Failure | ResolutionSuccess {
  const matchesRequestedIdentity = (sheet: ArchitectMutationOfferSheet) => {
    const normalizedDedupKey = String(dedupKey || '').trim();
    return (
      String(sheet.id || '') === state.offerSheetId ||
      (normalizedDedupKey.length > 0 &&
        String(sheet.dedupKey || '') === normalizedDedupKey)
    );
  };
  const homeMatches = (state.homeTeam?.incomingOfferSheets ?? []).filter(
    matchesRequestedIdentity
  );
  const offeringMatches = (state.offeringTeam?.offerSheets ?? []).filter(
    matchesRequestedIdentity
  );
  if (homeMatches.length !== 1 || offeringMatches.length !== 1) {
    return failure('incompatible', [
      'Offer Sheet resolution requires exactly one matching mirror on each Team.',
    ]);
  }
  const [homeSheet] = homeMatches;
  const [offeringSheet] = offeringMatches;
  const home = lifecycleFromSheet(homeSheet);
  const offering = lifecycleFromSheet(offeringSheet);
  if (!home.success || !offering.success)
    return failure('incompatible', [
      'Both Team mirrors require a readable governed Offer Sheet lifecycle.',
    ]);
  if (JSON.stringify(home.data) !== JSON.stringify(offering.data))
    return failure('incompatible', [
      'The two Team Offer Sheet lifecycle mirrors disagree.',
    ]);
  const lifecycle = home.data;
  if (
    String(state.homeTeam?.teamCode || '') !== lifecycle.homeTeamId ||
    String(state.offeringTeam?.teamCode || '') !== lifecycle.offeringTeamId
  ) {
    return failure('incompatible', [
      'The Offer Sheet mirrors are stored in Team containers that do not match the authenticated lifecycle identity.',
    ]);
  }
  const expectedSeason = toSeasonCode(lifecycle.salaryCapYear);
  const expectedEnvelopeStatuses =
    action === 'match'
      ? new Set(['PENDING_MATCH', 'MATCHED'])
      : new Set(['PENDING_MATCH', 'DECLINED']);
  const envelopeMatchesLifecycle = (sheet: ArchitectMutationOfferSheet) =>
    String(sheet.playerId || '') === lifecycle.playerId &&
    String(sheet.homeTeamCode || '') === lifecycle.homeTeamId &&
    String(sheet.offeringTeamCode || '') === lifecycle.offeringTeamId &&
    String(sheet.seasonKey || '') === expectedSeason &&
    Number(sheet.year) === lifecycle.salaryCapYear &&
    expectedEnvelopeStatuses.has(String(sheet.status || ''));
  if (
    String(homeSheet.id || '') !== String(offeringSheet.id || '') ||
    String(homeSheet.dedupKey || '') !== String(offeringSheet.dedupKey || '') ||
    String(homeSheet.status || '') !== String(offeringSheet.status || '') ||
    !envelopeMatchesLifecycle(homeSheet) ||
    !envelopeMatchesLifecycle(offeringSheet)
  ) {
    return failure('incompatible', [
      'The two Team Offer Sheet envelopes do not match the authenticated lifecycle identity.',
    ]);
  }
  if (lifecycle.status !== 'pending-match')
    return failure('blocked', ['Only a pending Offer Sheet can be resolved.']);
  const reasons: string[] = [];
  const exactAt = requireEasternInstant(
    resolutionAt,
    'Offer Sheet resolution',
    reasons
  );
  if (!exactAt) return failure('needs-input', reasons);
  if (!worldDateHasReachedInstant(worldAsOfDate, exactAt)) {
    reasons.push(
      'The Exercise Notice instant is after the governed Team Plan date.'
    );
  }
  const signedEvent = lifecycle.events[0];
  if (signedEvent.eventKind !== 'offer-sheet-signed')
    return failure('incompatible', [
      'The lifecycle has no signed Offer Sheet root event.',
    ]);
  if (compareInstant(exactAt, signedEvent.proposal.receivedAt) < 0) {
    reasons.push(
      'An Offer Sheet cannot be resolved before the home Team receives it.'
    );
  }
  if (
    action === 'match' &&
    compareInstant(exactAt, signedEvent.exerciseNoticeDeadline) > 0
  ) {
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
  let matchingTeamSalaryReference: GovernedOfferSheetTeamSalaryReference | null =
    null;
  if (action === 'decline' && election) {
    reasons.push(
      'An averaging election can accompany only an Exercise Notice.'
    );
  }
  if (election) {
    if (!lifecycle.reservations.arenasApplies)
      reasons.push('Only an Arenas match may elect Average Annual Salary.');
    if (
      !requireEasternInstant(
        election.deliveredToNbaAt,
        'Averaging election delivery',
        reasons
      )
    ) {
      reasons.push('The averaging election delivery time cannot be certified.');
    } else if (
      election.deliveredToNbaAt.slice(0, 10) !== exactAt.slice(0, 10)
    ) {
      reasons.push(
        'The averaging election was not delivered on the Exercise Notice date.'
      );
    }
    if (
      !worldDateHasReachedInstant(
        worldAsOfDate,
        election.relayedToPlayersAssociationAt
      )
    ) {
      reasons.push(
        'The Players Association relay is after the governed Team Plan date.'
      );
    }
    requireEasternInstant(
      election.relayedToPlayersAssociationAt,
      'Players Association relay',
      reasons
    );
    if (
      compareInstant(
        election.relayedToPlayersAssociationAt,
        election.deliveredToNbaAt
      ) < 0 ||
      businessDaysBetween(
        election.deliveredToNbaAt,
        election.relayedToPlayersAssociationAt
      ) > 1
    )
      reasons.push(
        'The averaging-election statement was not relayed within one business day.'
      );
    const matchingTeamCode = String(state.homeTeam?.teamCode || '');
    const matchingTotals = state.homeTeam
      ? synchronizeTeamTotalsSnapshotOrTeam(
          state.homeTeam,
          lifecycle.salaryCapYear
        ).totals
      : null;
    const matchingAllocations = Number(matchingTotals?.totalCapAllocations);
    const matchingStateReference = state.homeTeam
      ? `${lifecycle.worldId}:${matchingTeamCode}:${mutationSnapshotDigest(state.homeTeam)}`
      : '';
    const matchingSalaryEvaluation = evaluateDatedSalaryLedgers({
      context: {
        asOfDate: exactAt,
        salaryCapYear: lifecycle.salaryCapYear,
        team: { teamId: matchingTeamCode, teamCode: matchingTeamCode },
      },
      ledgers: {
        teamSalary: Number.isFinite(matchingAllocations)
          ? {
              status: 'ready',
              lineItems: [
                {
                  id: `pre-match-team-salary:${matchingTeamCode}:${lifecycle.salaryCapYear}`,
                  ledger: 'team-salary',
                  label: 'Pre-Match Team Salary',
                  amount: matchingAllocations,
                  effectiveFrom: `${lifecycle.salaryCapYear - 1}-07-01T00:00:00-04:00`,
                  canonLeafIds: ['CBA2-C15.10'],
                  source: {
                    authority: 'team-state',
                    reference: matchingStateReference,
                  },
                },
              ],
            }
          : {
              status: 'needs-input',
              missingInputs: ['ledgers.teamSalary.lineItems'],
              reason: 'Matching Team Salary cannot be resolved.',
            },
        apronTeamSalary: {
          status: 'not-evaluated',
          reason:
            'The Arenas election tests Team Salary against the Salary Cap.',
        },
        taxSalary: {
          status: 'not-evaluated',
          reason: 'The Arenas election does not use Tax Salary.',
        },
      },
    });
    const matchingTeamSalary = matchingSalaryEvaluation.ledgers.teamSalary;
    if (
      matchingTeamSalary.status !== 'complete' ||
      matchingTeamSalary.total == null
    ) {
      reasons.push(
        'Matching Team Salary cannot be resolved for the averaging election.'
      );
    } else if (
      matchingTeamSalary.total >= lifecycle.evidenceSnapshot.league.salaryCap
    ) {
      reasons.push(
        'Only a below-cap matching Team may elect Average Annual Salary.'
      );
    } else {
      matchingTeamSalaryReference = {
        ledgerKind: 'team-salary',
        asOfDate: exactAt,
        salaryCap: lifecycle.evidenceSnapshot.league.salaryCap,
        totalBeforeOfferSheet: matchingTeamSalary.total,
        teamStateReference: matchingStateReference,
        canonLeafIds: ['CBA2-C15.10'],
      };
    }
  }
  if (reasons.length > 0) return failure('blocked', reasons);
  const version = lifecycle.ledgerVersion + 1;
  const recordedAt = new Date(timestamp).toISOString();
  let resolutionEvent: GovernedOfferSheetLifecycle['events'][number];
  if (action === 'match') {
    const restrictionsUntil = oneYearAfter(exactAt);
    if (!restrictionsUntil) {
      return failure('incompatible', [
        'The matched-player restriction anniversary is not a valid Eastern-time instant.',
      ]);
    }
    resolutionEvent = {
      eventKind: 'offer-sheet-matched',
      eventId: `${lifecycle.ledgerId}:matched:v${version}`,
      eventVersion: 1,
      executedAt: exactAt,
      recordedAt,
      restrictionsUntil,
      playerTradeConsentRequired: true,
      offeringTeamTradeBarred: true,
      signAndTradeBarred: true,
      averagingElection: election,
      matchingTeamSalaryReference,
    };
  } else {
    resolutionEvent = {
      eventKind: 'offer-sheet-declined',
      eventId: `${lifecycle.ledgerId}:declined:v${version}`,
      eventVersion: 1,
      executedAt: exactAt,
      recordedAt,
    };
  }
  const next: GovernedOfferSheetLifecycle = {
    ...lifecycle,
    ledgerVersion: version,
    status: action === 'match' ? 'matched' : 'declined',
    reservations: {
      ...lifecycle.reservations,
      homeTeamAccounting:
        action === 'match' && election
          ? 'average-annual-salary'
          : 'stated-schedule',
    },
    events: [...lifecycle.events, resolutionEvent],
  };
  const parsed = GovernedOfferSheetLifecycleZ.safeParse(next);
  return parsed.success
    ? { success: true, lifecycle: parsed.data }
    : failure('incompatible', [
        'The resolved Offer Sheet lifecycle could not be certified.',
      ]);
}
