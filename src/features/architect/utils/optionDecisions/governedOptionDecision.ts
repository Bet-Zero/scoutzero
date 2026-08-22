/** Governed, fail-closed TO/PO/ETO decision authority for BZE-275. */

import type {
  ContractEventLedgerPayload,
  ContractEventRecord,
} from '@/schemas/contractEventLedger';
import type {
  GovernedContractState,
  GovernedOptionDecisionTerms,
  GovernedOptionRfaRelevanceEvidence,
} from '@/schemas/governedContractState';
import { GovernedOptionRfaRelevanceEvidenceZ } from '@/schemas/governedContractState';
import {
  GovernedOptionNoticeInputZ,
  type GovernedOptionDecisionChoice,
  type GovernedOptionNoticeInput,
} from '@/schemas/governedOptionDecision';
import type { RightsEventLedgerPayload } from '@/schemas/rightsEventLedger';
import {
  appendContractEvents,
  createContractEventLedger,
  encodeContractFieldEvidence,
  projectContractStateAsOf,
  toContractEventLedgerPayload,
  walkChain,
  type LifecycleEventLedger,
  type LifecycleProjectionManifest,
} from '@/features/architect/utils/contractHistory';
import {
  canonicalStringify,
  deterministicStateDigest,
} from '@/features/architect/utils/contractSource/deterministicDigest';
import {
  isDateOnly,
  isZonedDateTime,
  parseZonedDateTime,
} from '@/features/architect/utils/governedSeason';
import { projectRightsStateAsOf } from '@/features/architect/utils/rightsHistory';
import {
  toEndYear,
  toSeasonCode,
} from '@/features/architect/utils/seasonFormat';

export type GovernedOptionType = 'TO' | 'PO' | 'ETO';

export type GovernedOptionAvailabilityStatus =
  | 'ready'
  | 'needs-input'
  | 'decided'
  | 'incompatible';

export interface GovernedOptionDecisionAvailability {
  readonly status: GovernedOptionAvailabilityStatus;
  readonly playerId: string;
  readonly contractId: string | null;
  readonly targetYear: number;
  readonly optionType: GovernedOptionType | null;
  readonly reasons: readonly string[];
  readonly noticeRequirements: {
    readonly deadline: string;
    readonly windowOpensAt: string;
    readonly allowedMethods: readonly GovernedOptionNoticeInput['method'][];
    readonly recipientId: string;
    readonly recipientRole: 'player' | 'team';
    readonly leagueForwardingRequired: boolean;
  } | null;
}

export interface GovernedOptionLedgerAuthority {
  readonly baselineLedger: ContractEventLedgerPayload;
  readonly currentLedger: ContractEventLedgerPayload;
  readonly baselineSalaryCapYear: number;
  readonly overlayLedgerVersion: number | null;
}

export interface GovernedOptionDecisionRequest {
  authority: GovernedOptionLedgerAuthority;
  rightsLedger: RightsEventLedgerPayload | null | undefined;
  worldId: string;
  teamId: string;
  playerId: string;
  contractId: string;
  baselineSalaryCapYear: number;
  worldAsOfDate: string;
  targetYear: number;
  choice: GovernedOptionDecisionChoice;
  notice: GovernedOptionNoticeInput;
  operationId: string;
  authoringIdentity: string;
}

type GovernedOptionInspectionRequest = Omit<
  GovernedOptionDecisionRequest,
  | 'rightsLedger'
  | 'choice'
  | 'notice'
  | 'operationId'
  | 'authoringIdentity'
  | 'recordedAt'
>;

interface GovernedOptionInspection {
  readonly availability: GovernedOptionDecisionAvailability;
  readonly rfaEvidence: GovernedOptionRfaRelevanceEvidence | null;
}

export type GovernedOptionDecisionResult =
  | {
      readonly success: true;
      readonly optionType: GovernedOptionType;
      readonly choice: GovernedOptionDecisionChoice;
      readonly endsContract: boolean;
      readonly ledger: ContractEventLedgerPayload;
      readonly event: ContractEventRecord;
      readonly contractState: GovernedContractState;
      readonly manifest: LifecycleProjectionManifest;
      readonly freeAgentAmount: number | null;
      readonly freeAgentStatus: 'UFA' | null;
      readonly birdType: string | null;
      readonly priorTeamOfferCeiling: number | null;
      readonly expectedContractLedger: {
        readonly ledgerId: string;
        readonly ledgerVersion: number;
        readonly overlayLedgerVersion: number | null;
      };
      readonly expectedRightsLedger: {
        readonly ledgerId: string;
        readonly ledgerVersion: number;
      } | null;
    }
  | {
      readonly success: false;
      readonly status: 'needs-input' | 'incompatible' | 'decided';
      readonly reasons: readonly string[];
    };

const OPTION_CANON_LEAVES = Object.freeze([
  'CBA2-C16.1',
  'CBA2-C16.4',
  'CBA2-C16.5',
  'CBA2-C16.6',
  'CBA2-C16.7',
  'CBA2-C16.8',
  ...Array.from({ length: 22 }, (_, index) => `CBA2-C24.${index + 1}`),
  'CBA2-L02.1',
]);

function unavailable(
  status: 'needs-input' | 'incompatible' | 'decided',
  reasons: readonly string[]
): GovernedOptionDecisionResult {
  return Object.freeze({
    success: false as const,
    status,
    reasons: Object.freeze([...new Set(reasons)]),
  });
}

function exactInstant(
  value: { precision: string; value: string | null },
  label: string,
  reasons: string[]
): string | null {
  if (value.precision !== 'instant' || !isZonedDateTime(value.value)) {
    reasons.push(
      `${label} must be an exact governed instant with a UTC offset.`
    );
    return null;
  }
  return value.value;
}

function datePart(value: string): string {
  return value.slice(0, 10);
}

function latestGovernedInstant(values: readonly string[]): string {
  return values.reduce((latest, value) =>
    (parseZonedDateTime(value) ?? Number.NEGATIVE_INFINITY) >
    (parseZonedDateTime(latest) ?? Number.NEGATIVE_INFINITY)
      ? value
      : latest
  );
}

function addBusinessDays(date: string, count: number): string {
  const cursor = new Date(`${date}T12:00:00Z`);
  let added = 0;
  while (added < count) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    const day = cursor.getUTCDay();
    if (day !== 0 && day !== 6) added += 1;
  }
  return cursor.toISOString().slice(0, 10);
}

function rookieScaleDeadlineDate(targetYear: number): string {
  const october31 = `${targetYear - 2}-10-31`;
  const date = new Date(`${october31}T12:00:00Z`);
  const day = date.getUTCDay();
  if (day === 6) return addBusinessDays(october31, 1);
  if (day === 0) return addBusinessDays(october31, 1);
  return october31;
}

function ordinaryRfaExerciseDeadline(targetYear: number): string {
  return `${targetYear - 1}-06-25T00:00:00-04:00`;
}

function authenticatedRfaRelevanceEvidence(
  state: GovernedContractState,
  terms: GovernedOptionDecisionTerms,
  targetYear: number,
  worldAsOfDate: string,
  reasons: string[]
): GovernedOptionRfaRelevanceEvidence | null {
  if (
    terms.rfaRelevanceEvidence === null ||
    terms.rfaRelevanceEvidence === undefined
  ) {
    reasons.push(
      'RFA-relevance evidence is missing for this ordinary Option.'
    );
    return null;
  }
  const parsed = GovernedOptionRfaRelevanceEvidenceZ.safeParse(
    terms.rfaRelevanceEvidence
  );
  if (!parsed.success) {
    reasons.push(
      'RFA-relevance evidence is malformed and must be re-established from the pinned source.'
    );
    return null;
  }
  const evidence = parsed.data;
  if (evidence.status === 'conflicting') {
    reasons.push(
      'RFA-relevance evidence is contradictory and cannot govern this Option.'
    );
  } else if (
    evidence.status !== 'known' ||
    evidence.declineFreeAgencyStatus === null
  ) {
    reasons.push(
      'RFA-relevance evidence does not establish whether declining this Option would create RFA status.'
    );
  }
  if (evidence.salaryCapYear !== targetYear) {
    reasons.push(
      `RFA-relevance evidence is stale for Salary Cap Year ${targetYear}.`
    );
  }
  if (
    evidence.observedAt.precision !== 'date' ||
    !isDateOnly(evidence.observedAt.value) ||
    evidence.observedAt.value > worldAsOfDate
  ) {
    reasons.push(
      'RFA-relevance evidence must have a governed observation date on or before the Team Plan date.'
    );
  }
  const source = state.source;
  if (!('releaseId' in source)) {
    reasons.push(
      'RFA-relevance evidence cannot authenticate against an Architect-authored signing source.'
    );
    return evidence;
  }
  if (
    evidence.sourceIdentity.releaseId !== source.releaseId ||
    evidence.sourceIdentity.releaseVersion !== source.releaseVersion ||
    evidence.sourceIdentity.releaseDigest !== source.releaseDigest ||
    evidence.sourceIdentity.sourceProvider !== source.sourceProvider ||
    evidence.sourceIdentity.sourceRecordVersion !==
      source.sourceRecordVersion ||
    evidence.sourceIdentity.sourceObservationId !==
      source.sourceObservationId ||
    evidence.sourceIdentity.sourceArtifactSha256 !==
      source.sourceArtifactSha256 ||
    evidence.sourceIdentity.sourceContractPath !== source.sourceContractPath
  ) {
    reasons.push(
      'RFA-relevance evidence is unauthenticated because it does not match the pinned Contract source identity.'
    );
  }
  return evidence;
}

function eventChain(
  ledger: LifecycleEventLedger
): readonly ContractEventRecord[] {
  const current = ledger.events.filter(
    (event) => event.recordStatus === 'current'
  );
  return walkChain(current) ?? [];
}

function rootEvent(ledger: LifecycleEventLedger): ContractEventRecord | null {
  return (
    ledger.events.find(
      (event) =>
        event.recordStatus === 'current' &&
        (event.eventKind === 'source-establishment' ||
          event.eventKind === 'signing')
    ) ?? null
  );
}

/** Validate that a writable overlay is only an append to its immutable root. */
export function resolveGovernedOptionLedgerAuthority({
  baselineLedger,
  overlayLedger,
  baselineSalaryCapYear,
}: {
  baselineLedger: unknown;
  overlayLedger?: unknown;
  baselineSalaryCapYear: number;
}): GovernedOptionLedgerAuthority {
  const baseline = createContractEventLedger(
    baselineLedger as ContractEventLedgerPayload
  );
  const current = overlayLedger
    ? createContractEventLedger(overlayLedger as ContractEventLedgerPayload)
    : baseline;
  const baselineRoot = rootEvent(baseline);
  const currentRoot = rootEvent(current);
  const baselineChain = eventChain(baseline);
  const currentChain = eventChain(current);
  if (
    !baselineRoot ||
    !currentRoot ||
    baseline.ledgerId !== current.ledgerId ||
    canonicalStringify(baselineRoot) !== canonicalStringify(currentRoot) ||
    baselineChain.length > currentChain.length ||
    baselineChain.some(
      (event, index) =>
        canonicalStringify(event) !== canonicalStringify(currentChain[index])
    )
  ) {
    throw new Error(
      'The writable contract history does not preserve the pinned governed baseline root.'
    );
  }
  return Object.freeze({
    baselineLedger: toContractEventLedgerPayload(baseline),
    currentLedger: toContractEventLedgerPayload(current),
    baselineSalaryCapYear,
    overlayLedgerVersion: overlayLedger ? current.ledgerVersion : null,
  });
}

function validateOptionShape(
  state: GovernedContractState,
  optionIndex: number,
  targetYear: number,
  worldAsOfDate: string,
  reasons: string[]
): GovernedOptionDecisionTerms | null {
  const salaries = state.terms.salaries;
  const row = salaries[optionIndex];
  const optionType = row?.option;
  if (!row || !optionType) {
    reasons.push(`No governed option exists for ${toSeasonCode(targetYear)}.`);
    return null;
  }
  const expectedHolder = optionType === 'TO' ? 'team' : 'player';
  if (row.optionHolder !== expectedHolder) {
    reasons.push(
      `${optionType} holder evidence is missing or contradicts the required ${expectedHolder} holder.`
    );
  }
  if (row.optionUsed !== null) {
    reasons.push(
      `${optionType} for ${row.season} already has a governed decision.`
    );
  }
  const deadline = exactInstant(
    row.optionDecisionDeadline,
    'The exact contractual notice deadline',
    reasons
  );
  const terms = row.optionDecisionTerms ?? null;
  if (!terms) {
    reasons.push(
      `Governed ${optionType} shape, protection, window, and notice terms are missing for ${row.season}.`
    );
    return null;
  }
  if (terms.conditional) {
    reasons.push(
      `${optionType} is conditional; this V1 path supports only unconditional options.`
    );
  }
  if (salaries.length !== state.terms.contractLength) {
    reasons.push('Contract length and governed salary-row count conflict.');
  }
  if (!state.terms.isRookieScale && optionIndex !== salaries.length - 1) {
    reasons.push(
      `${optionType} must govern exactly one final Contract Season on this path.`
    );
  }
  const counts = salaries.reduce(
    (result, salary) => {
      if (salary.option) result[salary.option] += 1;
      return result;
    },
    { TO: 0, PO: 0, ETO: 0 }
  );
  if (!state.terms.isRookieScale && (counts.TO > 1 || counts.PO > 1)) {
    reasons.push(
      'An ordinary Contract may carry at most one Team Option and one Player Option.'
    );
  }
  if (counts.ETO > 1) reasons.push('A Contract may carry at most one ETO.');

  const prior = salaries[optionIndex - 1];
  if (!prior) {
    reasons.push('The preceding Contract Season is missing.');
  } else {
    const rowSalary = row.salary ?? row.capHit;
    const priorSalary = prior.salary ?? prior.capHit;
    if (rowSalary === null || priorSalary === null || rowSalary < priorSalary) {
      reasons.push(
        'Option salary may not be lower than the preceding Season salary.'
      );
    }
    if (
      row.incentives.likely === null ||
      prior.incentives.likely === null ||
      row.incentives.likely < prior.incentives.likely ||
      row.incentives.unlikely === null ||
      prior.incentives.unlikely === null ||
      row.incentives.unlikely < prior.incentives.unlikely
    ) {
      reasons.push(
        'Option likely and unlikely bonuses may not decrease from the preceding Season.'
      );
    }
  }
  if (!terms.nonCompensationTermsMatchPriorSeason) {
    reasons.push(
      'The source does not establish that non-compensation terms carry forward.'
    );
  }
  if (!terms.compensationProtectionMatchesPriorSeason) {
    reasons.push(
      'The source does not establish the required Compensation Protection treatment.'
    );
  }

  if (state.terms.isRookieScale) {
    if (
      state.terms.contractLength !== 4 ||
      salaries.length !== 4 ||
      salaries[2]?.option !== 'TO' ||
      salaries[3]?.option !== 'TO'
    ) {
      reasons.push(
        'A Rookie Scale Contract must have two initial Seasons and Team Options for Seasons three and four.'
      );
    }
    const expectedOrdinal =
      optionIndex === 2 ? 'third' : optionIndex === 3 ? 'fourth' : null;
    if (
      optionType !== 'TO' ||
      terms.rookieScaleOptionOrdinal !== expectedOrdinal
    ) {
      reasons.push(
        'Rookie Scale Team Option ordinal evidence conflicts with the Contract shape.'
      );
    }
    if (
      expectedOrdinal === 'fourth' &&
      terms.rookieScaleFourthSeasonTermsMatchThird !== true
    ) {
      reasons.push(
        'Fourth-Season Rookie Scale terms and protection are not established as matching Season three except for salary.'
      );
    }
    if (
      deadline &&
      datePart(deadline) !== rookieScaleDeadlineDate(targetYear)
    ) {
      reasons.push(
        `Rookie Scale Team Option deadline must be ${rookieScaleDeadlineDate(targetYear)} after the business-day adjustment.`
      );
    }
    if (row.salary === null) {
      reasons.push(
        'Rookie Scale Team Option Salary is missing; cap hit cannot establish the prior-team offer ceiling.'
      );
    }
  } else if (deadline) {
    const latestOrdinaryDeadline = Date.parse(
      `${targetYear - 1}-06-29T17:00:00-04:00`
    );
    if (
      (parseZonedDateTime(deadline) ?? Number.POSITIVE_INFINITY) >
      latestOrdinaryDeadline
    ) {
      reasons.push(
        'Ordinary Option/ETO deadline may not be later than June 29 at 5:00 p.m. Eastern.'
      );
    }
  }

  if (optionType === 'PO') {
    if (!terms.playerOptionProtectionAlternative) {
      reasons.push('Player Option protection alternative A or B is missing.');
    }
    if (
      terms.playerOptionProtectionAlternative === 'A' &&
      terms.preExerciseProtectionApplies !== true
    ) {
      reasons.push(
        'Player Option alternative A must apply Compensation Protection before exercise.'
      );
    }
    if (
      terms.playerOptionProtectionAlternative === 'B' &&
      terms.preExerciseProtectionApplies !== false
    ) {
      reasons.push(
        'Player Option alternative B may not apply Compensation Protection before exercise.'
      );
    }
  } else if (
    terms.playerOptionProtectionAlternative !== null ||
    terms.preExerciseProtectionApplies !== null
  ) {
    reasons.push(
      'Non-Player-Option terms carry contradictory Player Option protection data.'
    );
  }

  if (optionType === 'ETO') {
    if (row.optionHolder !== 'player' || optionIndex < 4) {
      reasons.push(
        'An ETO must be an unconditional player right that cannot end a Contract before Season four is complete.'
      );
    }
    if (!terms.etoOrigin || terms.etoAddedDuringOriginalTerm !== false) {
      reasons.push(
        'ETO origin/amendment evidence is missing or shows an impermissible in-term addition.'
      );
    }
    if (
      state.terms.isExtension &&
      !String(state.terms.contractType || '')
        .toLowerCase()
        .includes('rookie')
    ) {
      reasons.push('A Veteran Extension may not add or retain an ETO.');
    }
  } else if (
    terms.etoOrigin !== null ||
    terms.etoAddedDuringOriginalTerm !== null
  ) {
    reasons.push('Non-ETO terms carry contradictory ETO origin data.');
  }

  return terms;
}

function inspectGovernedOptionDecisionInternal({
  authority,
  worldId,
  teamId,
  playerId,
  contractId,
  targetYear,
  baselineSalaryCapYear,
  worldAsOfDate,
}: GovernedOptionInspectionRequest): GovernedOptionInspection {
  const reasons: string[] = [];
  try {
    if (
      authority.baselineSalaryCapYear !== baselineSalaryCapYear ||
      !isDateOnly(worldAsOfDate)
    ) {
      return Object.freeze({
        availability: Object.freeze({
          status: 'incompatible' as const,
          playerId,
          contractId,
          targetYear,
          optionType: null,
          reasons: Object.freeze([
            'The governed world date, baseline Salary Cap Year, and contract release do not align. Recreate the Team Plan if it predates this boundary.',
          ]),
          noticeRequirements: null,
        }),
        rfaEvidence: null,
      });
    }
    const ledger = createContractEventLedger(authority.currentLedger);
    const chain = eventChain(ledger);
    const latest = chain.at(-1);
    if (
      !latest ||
      latest.worldId !== worldId ||
      latest.playerId !== playerId ||
      latest.contractId !== contractId
    ) {
      throw new Error(
        'The governed contract identity does not match this player and world.'
      );
    }
    const state = latest.resultingState;
    const optionIndex = state.terms.salaries.findIndex(
      (row) => toEndYear(row.season) === targetYear && row.option !== null
    );
    if (optionIndex < 0) {
      reasons.push(
        `No governed option exists for ${toSeasonCode(targetYear)}.`
      );
    }
    const row = state.terms.salaries[optionIndex];
    const terms =
      optionIndex >= 0
        ? validateOptionShape(
            state,
            optionIndex,
            targetYear,
            worldAsOfDate,
            reasons
          )
        : null;
    const rfaEvidence =
      terms && !state.terms.isRookieScale && row?.option !== 'ETO'
        ? authenticatedRfaRelevanceEvidence(
            state,
            terms,
            targetYear,
            worldAsOfDate,
            reasons
          )
        : null;
    const decided = row ? row.optionUsed !== null : false;
    return Object.freeze({
      availability: Object.freeze({
        status: decided
          ? ('decided' as const)
          : reasons.length > 0 || !terms
            ? ('needs-input' as const)
            : ('ready' as const),
        playerId,
        contractId,
        targetYear,
        optionType: (row?.option as GovernedOptionType | null) ?? null,
        reasons: Object.freeze([...new Set(reasons)]),
        noticeRequirements:
          reasons.length === 0 && terms && row
            ? Object.freeze({
                deadline: row.optionDecisionDeadline.value || '',
                windowOpensAt: terms.decisionWindowOpensAt.value || '',
                allowedMethods: Object.freeze([...terms.allowedNoticeMethods]),
                recipientId:
                  terms.noticeRecipient === 'team' ? teamId : playerId,
                recipientRole: terms.noticeRecipient,
                leagueForwardingRequired: terms.leagueForwardingRequired,
              })
            : null,
      }),
      rfaEvidence,
    });
  } catch (error) {
    return Object.freeze({
      availability: Object.freeze({
        status: 'incompatible' as const,
        playerId,
        contractId,
        targetYear,
        optionType: null,
        reasons: Object.freeze([
          error instanceof Error
            ? error.message
            : 'Governed contract history is unreadable.',
        ]),
        noticeRequirements: null,
      }),
      rfaEvidence: null,
    });
  }
}

export function inspectGovernedOptionDecision(
  request: GovernedOptionInspectionRequest
): GovernedOptionDecisionAvailability {
  return inspectGovernedOptionDecisionInternal(request).availability;
}

function validateNotice({
  notice,
  choice,
  optionType,
  declineFreeAgencyStatus,
  targetYear,
  terms,
  deadline,
  worldAsOfDate,
  teamId,
  playerId,
  reasons,
}: {
  notice: GovernedOptionNoticeInput;
  choice: GovernedOptionDecisionChoice;
  optionType: GovernedOptionType;
  declineFreeAgencyStatus: 'RFA' | 'UFA' | null;
  targetYear: number;
  terms: GovernedOptionDecisionTerms;
  deadline: string;
  worldAsOfDate: string;
  teamId: string;
  playerId: string;
  reasons: string[];
}): void {
  const parsed = GovernedOptionNoticeInputZ.safeParse(notice);
  if (!parsed.success) {
    reasons.push(
      `Notice evidence is incomplete: ${parsed.error.issues[0]?.message ?? 'invalid input'}.`
    );
    return;
  }
  const delivered = parseZonedDateTime(notice.deliveredAt);
  const received = parseZonedDateTime(notice.leagueReceivedAt);
  const forwarded = parseZonedDateTime(notice.playersAssociationForwardedAt);
  const deadlineTime = parseZonedDateTime(deadline);
  const opensAt = exactInstant(
    terms.decisionWindowOpensAt,
    'Decision-window opening',
    reasons
  );
  if (delivered === null)
    reasons.push(
      'Notice delivery must be an exact governed instant with a UTC offset.'
    );
  if (!terms.allowedNoticeMethods.includes(notice.method)) {
    reasons.push(
      `${notice.method} is not an allowed notice method for this governed Contract.`
    );
  }
  const expectedRecipient =
    terms.noticeRecipient === 'team' ? teamId : playerId;
  if (notice.recipient.trim() !== expectedRecipient) {
    reasons.push(
      `Notice recipient must be the governed ${terms.noticeRecipient} identity ${expectedRecipient}.`
    );
  }
  if (delivered !== null && deadlineTime !== null && delivered > deadlineTime) {
    reasons.push('Notice was delivered after the exact contractual deadline.');
  }
  if (
    optionType !== 'ETO' &&
    choice === 'exercise' &&
    declineFreeAgencyStatus === 'RFA' &&
    delivered !== null &&
    delivered >=
      (parseZonedDateTime(ordinaryRfaExerciseDeadline(targetYear)) ??
        Number.NEGATIVE_INFINITY)
  ) {
    reasons.push(
      `An Option whose decline would create RFA status must be exercised strictly before ${ordinaryRfaExerciseDeadline(targetYear)}.`
    );
  }
  if (
    delivered !== null &&
    opensAt &&
    delivered < (parseZonedDateTime(opensAt) ?? Number.POSITIVE_INFINITY)
  ) {
    reasons.push(
      'Notice was delivered before the governed decision window opened.'
    );
  }
  const governedEvidence = terms.leagueForwardingRequired
    ? [
        notice.deliveredAt,
        notice.leagueReceivedAt,
        notice.playersAssociationForwardedAt,
      ]
    : [notice.deliveredAt];
  const evidenceAfterWorldDate = governedEvidence.some(
    (value) => datePart(value) > worldAsOfDate
  );
  if (evidenceAfterWorldDate) {
    reasons.push(
      'Notice delivery, NBA receipt, and Players Association forwarding evidence must not occur after the Team Plan’s governed date.'
    );
  }
  if (
    terms.leagueForwardingRequired &&
    (received === null || forwarded === null)
  ) {
    reasons.push(
      'NBA receipt and Players Association forwarding must be exact governed instants.'
    );
  } else if (
    terms.leagueForwardingRequired &&
    received !== null &&
    forwarded !== null &&
    ((delivered !== null && received < delivered) || forwarded < received)
  ) {
    reasons.push(
      'NBA receipt and Players Association forwarding chronology is contradictory.'
    );
  } else if (
    terms.leagueForwardingRequired &&
    received !== null &&
    forwarded !== null &&
    datePart(notice.playersAssociationForwardedAt) >
      addBusinessDays(datePart(notice.leagueReceivedAt), 2)
  ) {
    reasons.push(
      'The NBA notice was not forwarded to the Players Association within two business days.'
    );
  }
  if (
    optionType === 'PO' &&
    choice === 'exercise' &&
    terms.playerOptionProtectionAlternative === 'B'
  ) {
    const lastGame = exactInstant(
      terms.teamLastGameAt,
      'Team last-game evidence',
      reasons
    );
    if (lastGame && datePart(notice.deliveredAt) <= datePart(lastGame)) {
      reasons.push(
        'Player Option alternative B cannot be exercised before the day after the Team’s last game.'
      );
    }
  }
}

function withStateDigest(
  state: Omit<GovernedContractState, 'stateDigest'>
): GovernedContractState {
  return Object.freeze({
    ...state,
    stateDigest: deterministicStateDigest(state),
  });
}

/** Evaluate and append one decision without mutating any caller-owned value. */
export function decideGovernedOption(
  request: GovernedOptionDecisionRequest
): GovernedOptionDecisionResult {
  const inspection = inspectGovernedOptionDecisionInternal(request);
  const { availability, rfaEvidence } = inspection;
  if (availability.status !== 'ready' || !availability.optionType) {
    return unavailable(
      availability.status === 'incompatible'
        ? 'incompatible'
        : availability.status === 'decided'
          ? 'decided'
          : 'needs-input',
      availability.reasons
    );
  }
  const ledger = createContractEventLedger(request.authority.currentLedger);
  const chain = eventChain(ledger);
  const latest = chain.at(-1);
  if (!latest)
    return unavailable('incompatible', ['Governed contract history is empty.']);
  const state = latest.resultingState;
  const optionIndex = state.terms.salaries.findIndex(
    (row) => toEndYear(row.season) === request.targetYear && row.option !== null
  );
  const row = state.terms.salaries[optionIndex];
  const reasons: string[] = [];
  const terms = validateOptionShape(
    state,
    optionIndex,
    request.targetYear,
    request.worldAsOfDate,
    reasons
  );
  const deadline = row
    ? exactInstant(
        row.optionDecisionDeadline,
        'The exact contractual notice deadline',
        reasons
      )
    : null;
  if (!terms || !deadline || !row?.option)
    return unavailable('needs-input', reasons);
  validateNotice({
    notice: request.notice,
    choice: request.choice,
    optionType: row.option,
    declineFreeAgencyStatus:
      rfaEvidence?.status === 'known'
        ? rfaEvidence.declineFreeAgencyStatus
        : null,
    targetYear: request.targetYear,
    terms,
    deadline,
    worldAsOfDate: request.worldAsOfDate,
    teamId: request.teamId,
    playerId: request.playerId,
    reasons,
  });
  if (!request.operationId.trim() || !request.authoringIdentity.trim()) {
    reasons.push(
      'Decision provenance requires an operation identity and author identity.'
    );
  }
  const contractEndsAt = exactInstant(
    terms.contractEndsAt,
    'Contract termination boundary',
    reasons
  );
  const projection = projectContractStateAsOf({
    ledger,
    worldId: request.worldId,
    contractId: request.contractId,
    asOfDate: request.notice.deliveredAt,
    salaryCapYear: request.baselineSalaryCapYear,
  });
  if (
    projection.state !== 'projected' ||
    !projection.contractState ||
    !projection.manifest
  ) {
    reasons.push(
      projection.unavailableReasons[0] ||
        projection.needsInputReasons[0] ||
        'The predecessor Contract version cannot be projected at the notice instant.'
    );
  }
  const endsContract =
    (row.option === 'ETO' && request.choice === 'exercise') ||
    (row.option !== 'ETO' && request.choice === 'decline');
  if (!contractEndsAt) return unavailable('needs-input', reasons);
  const effectiveAt = endsContract
    ? contractEndsAt
    : request.notice.deliveredAt;
  if (
    effectiveAt &&
    parseZonedDateTime(`${request.worldAsOfDate}T23:59:59-04:00`)! <
      (parseZonedDateTime(effectiveAt) ?? Number.POSITIVE_INFINITY)
  ) {
    reasons.push(
      `The decision takes effect at ${effectiveAt}; advance the Team Plan to that governed boundary before applying its roster and books result.`
    );
  }
  let freeAgentAmount: number | null = null;
  let birdType: string | null = null;
  let expectedRightsLedger: {
    ledgerId: string;
    ledgerVersion: number;
  } | null = null;
  if (endsContract) {
    const rights = projectRightsStateAsOf({
      ledger: request.rightsLedger,
      worldId: request.worldId,
      teamId: request.teamId,
      playerId: request.playerId,
      asOfDate: datePart(contractEndsAt),
      salaryCapYear: request.targetYear,
    });
    if (rights.status !== 'available' || !rights.ledgerReference) {
      const rightsReason =
        rights.reasons[0] ||
        'Governed rights and Free Agent Amount evidence is incomplete for the Contract-ending decision.';
      reasons.push(`Governed rights/Free Agent Amount: ${rightsReason}`);
      if (rightsReason.includes('Right of First Refusal')) {
        reasons.push(
          'Option-created RFA state requires governed QO, Maximum QO, and Right of First Refusal amount authority; CBA2-C01.7 remains open.'
        );
      }
    } else if (rights.freeAgentStatus !== 'UFA') {
      reasons.push(
        'Option-created RFA state requires a governed QO, Maximum QO, and Right of First Refusal amount authority; CBA2-C01.7 remains open.'
      );
    } else {
      freeAgentAmount = rights.freeAgentAmount;
      birdType = rights.birdType;
      expectedRightsLedger = rights.ledgerReference;
    }
  }
  if (reasons.length > 0 || !projection.contractState || !projection.manifest) {
    return unavailable('needs-input', reasons);
  }

  const nextVersion = projection.contractState.contractVersion + 1;
  const salaries = projection.contractState.terms.salaries.map(
    (salary, index) => ({
      ...salary,
      ...(index === optionIndex
        ? {
            optionUsed: request.choice === 'exercise',
            optionDecisionDate: {
              precision: 'instant' as const,
              value: request.notice.deliveredAt,
              rawValue: request.notice.deliveredAt,
            },
          }
        : {}),
    })
  );
  const resultingSalaries = endsContract
    ? salaries.slice(0, optionIndex)
    : salaries;
  const totalValue = resultingSalaries.reduce(
    (sum, salary) => sum + (salary.salary ?? salary.capHit ?? 0),
    0
  );
  const guaranteedValue = resultingSalaries.reduce(
    (sum, salary) =>
      sum +
      (salary.guaranteedAmount ??
        (salary.guaranteed ? (salary.salary ?? 0) : 0)),
    0
  );
  const remainingOptions = resultingSalaries.filter(
    (salary) => salary.option !== null && salary.optionUsed === null
  );
  // The digest is deliberately omitted before computing the successor state.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const {
    stateDigest: _predecessorStateDigest,
    ...predecessorStateWithoutDigest
  } = projection.contractState;
  const stateWithoutDigest: Omit<GovernedContractState, 'stateDigest'> = {
    ...predecessorStateWithoutDigest,
    contractVersion: nextVersion,
    terms: {
      ...projection.contractState.terms,
      salaries: resultingSalaries,
      endSeason: resultingSalaries.at(-1)?.season ?? null,
      contractLength: resultingSalaries.length,
      totalValue,
      averageAnnualValue:
        resultingSalaries.length > 0
          ? Math.round(totalValue / resultingSalaries.length)
          : 0,
      guaranteedValue,
      guaranteedYears: resultingSalaries.filter(
        (salary) => salary.guaranteed === true
      ).length,
      birdRights: endsContract
        ? {
            ...projection.contractState.terms.birdRights,
            status: birdType,
          }
        : projection.contractState.terms.birdRights,
      freeAgency: endsContract
        ? {
            ...projection.contractState.terms.freeAgency,
            type: 'UFA',
            year: request.targetYear,
            capHold: freeAgentAmount,
            qualifyingOffer: null,
            hasOption: false,
            optionYear: null,
            optionType: null,
            earlyTerminationOption: null,
          }
        : {
            ...projection.contractState.terms.freeAgency,
            hasOption: remainingOptions.length > 0,
            optionYear: remainingOptions[0]?.season ?? null,
            optionType: remainingOptions[0]?.option ?? null,
          },
    },
    evidence: [
      ...projection.contractState.evidence,
      encodeContractFieldEvidence({
        fieldPath: `terms.salaries[${optionIndex}].optionUsed`,
        status: 'known',
        sourcePath: `optionNotice:${request.operationId}`,
        transformationId: 'governed-option-decision-v1',
        limitationIds: [],
      }),
    ],
    completeness: { status: 'complete', reasons: [] },
  };
  const resultingState = withStateDigest(stateWithoutDigest);
  const eventKind =
    row.option === 'ETO'
      ? request.choice === 'exercise'
        ? 'eto-exercise'
        : 'eto-decline'
      : request.choice === 'exercise'
        ? 'option-exercise'
        : 'option-decline';
  const event: ContractEventRecord = {
    eventId: `${request.contractId}:${row.option.toLowerCase()}:${toSeasonCode(request.targetYear)}:${request.choice}:v${nextVersion}`,
    eventVersion: 1,
    eventKind,
    worldId: request.worldId,
    contractId: request.contractId,
    playerId: request.playerId,
    teamId: request.teamId,
    executedAt: request.notice.deliveredAt,
    effectiveAt: effectiveAt as string,
    recordedAt: latestGovernedInstant([
      request.notice.deliveredAt,
      ...(terms.leagueForwardingRequired
        ? [
            request.notice.leagueReceivedAt,
            request.notice.playersAssociationForwardedAt,
          ]
        : []),
      effectiveAt as string,
    ]),
    predecessorContractVersion: projection.contractVersion,
    resultingContractVersion: nextVersion,
    predecessorEventId: projection.effectiveEvent?.eventId ?? null,
    sourceTransactionId: request.operationId,
    authoringIdentity: request.authoringIdentity,
    recordStatus: 'current',
    supersedesEventVersion: null,
    canonLeafIds: OPTION_CANON_LEAVES,
    resultingState,
  };
  let nextLedger: LifecycleEventLedger;
  try {
    nextLedger = appendContractEvents(ledger, [event]);
  } catch (error) {
    return unavailable('incompatible', [
      error instanceof Error
        ? error.message
        : 'The immutable option event could not be appended.',
    ]);
  }
  const replay = projectContractStateAsOf({
    ledger: nextLedger,
    worldId: request.worldId,
    contractId: request.contractId,
    asOfDate: effectiveAt as string,
    salaryCapYear: endsContract
      ? request.targetYear
      : request.baselineSalaryCapYear,
  });
  if (
    replay.state !== 'projected' ||
    replay.contractVersion !== nextVersion ||
    replay.contractState?.stateDigest !== resultingState.stateDigest ||
    !replay.manifest
  ) {
    return unavailable('incompatible', [
      'The appended option event did not replay to its exact resulting Contract version.',
    ]);
  }
  const priorTeamOfferCeiling =
    endsContract &&
    row.option === 'TO' &&
    projection.contractState.terms.isRookieScale
      ? row.salary
      : null;
  return Object.freeze({
    success: true as const,
    optionType: row.option,
    choice: request.choice,
    endsContract,
    ledger: toContractEventLedgerPayload(nextLedger),
    event,
    contractState: resultingState,
    manifest: replay.manifest,
    freeAgentAmount,
    freeAgentStatus: endsContract ? ('UFA' as const) : null,
    birdType,
    priorTeamOfferCeiling,
    expectedContractLedger: Object.freeze({
      ledgerId: ledger.ledgerId,
      ledgerVersion: ledger.ledgerVersion,
      overlayLedgerVersion: request.authority.overlayLedgerVersion,
    }),
    expectedRightsLedger: expectedRightsLedger
      ? Object.freeze({ ...expectedRightsLedger })
      : null,
  });
}
