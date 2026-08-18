/** Governed, fail-closed Rookie Scale, Veteran, and Designated Veteran extensions. */

import type {
  ContractEventLedgerPayload,
  ContractEventRecord,
} from '@/schemas/contractEventLedger';
import type {
  ContractSalaryTerm,
  GovernedContractState,
} from '@/schemas/governedContractState';
import {
  GovernedExtensionContractEvidenceZ,
  GovernedExtensionLeagueEvidenceZ,
  GovernedExtensionProposalZ,
  type GovernedExtensionBonus,
  type GovernedExtensionCompensation,
  type GovernedExtensionContractEvidence,
  type GovernedExtensionLeagueEvidence,
  type GovernedExtensionProposal,
  type GovernedExtensionRoute,
} from '@/schemas/governedExtension';
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
import { deterministicStateDigest } from '@/features/architect/utils/contractSource/deterministicDigest';
import {
  isDateOnly,
  isZonedDateTime,
  parseZonedDateTime,
} from '@/features/architect/utils/governedSeason';
import {
  toEndYear,
  toSeasonCode,
} from '@/features/architect/utils/seasonFormat';
import {
  resolveGovernedOptionLedgerAuthority,
  type GovernedOptionLedgerAuthority,
} from '@/features/architect/utils/optionDecisions/governedOptionDecision';

export type GovernedExtensionLedgerAuthority = GovernedOptionLedgerAuthority;

export type GovernedExtensionAvailabilityStatus =
  | 'ready'
  | 'needs-input'
  | 'incompatible';

export interface GovernedExtensionAvailability {
  readonly status: GovernedExtensionAvailabilityStatus;
  readonly playerId: string;
  readonly contractId: string | null;
  readonly reasons: readonly string[];
  readonly suggestedRoute: GovernedExtensionRoute | null;
  readonly allowedRoutes: readonly GovernedExtensionRoute[];
  readonly firstExtendedSeason: string | null;
}

export interface GovernedExtensionRequest {
  authority: GovernedExtensionLedgerAuthority;
  worldId: string;
  teamId: string;
  playerId: string;
  contractId: string;
  worldAsOfDate: string;
  proposal: GovernedExtensionProposal;
  operationId: string;
  authoringIdentity: string;
  recordedAt: string;
}

export type GovernedExtensionResult =
  | {
      readonly success: true;
      readonly route: GovernedExtensionRoute;
      readonly ledger: ContractEventLedgerPayload;
      readonly event: ContractEventRecord;
      readonly contractState: GovernedContractState;
      readonly extensionSalaries: readonly ContractSalaryTerm[];
      readonly manifest: LifecycleProjectionManifest;
      readonly expectedContractLedger: {
        readonly ledgerId: string;
        readonly ledgerVersion: number;
        readonly overlayLedgerVersion: number | null;
      };
    }
  | {
      readonly success: false;
      readonly status: GovernedExtensionAvailabilityStatus;
      readonly reasons: readonly string[];
    };

type ReadyEvidence = {
  state: GovernedContractState;
  contract: GovernedExtensionContractEvidence;
  league: GovernedExtensionLeagueEvidence;
  firstExtendedSeason: string;
};

const COMMON_CANON_LEAVES = Object.freeze([
  'CBA2-C16.10',
  'CBA2-C16.11',
  'CBA2-C16.12',
  'CBA2-C16.13',
  'CBA2-C16.14',
  'CBA2-C16.15',
  'CBA2-C16.35',
  'CBA2-C22.17',
  'CBA2-C22.18',
  'CBA2-C22.19',
  'CBA2-C23.1',
  'CBA2-C23.2',
  'CBA2-C23.3',
  'CBA2-L02.1',
]);

const ROUTE_CANON_LEAVES: Readonly<Record<GovernedExtensionRoute, readonly string[]>> =
  Object.freeze({
    'rookie-scale': Object.freeze([
      'CBA2-C16.18',
      'CBA2-C16.19',
      'CBA2-C16.20',
      'CBA2-C16.21',
      'CBA2-C16.22',
      'CBA2-C16.36',
    ]),
    veteran: Object.freeze([
      'CBA2-C16.23',
      'CBA2-C16.24',
      'CBA2-C16.25',
      'CBA2-C16.26',
      'CBA2-C16.27',
      'CBA2-C16.39',
      'CBA2-C16.40',
      'CBA2-C16.41',
      'CBA2-C16.42',
      'CBA2-C16.43',
      'CBA2-C16.44',
      'CBA2-C16.45',
      'CBA2-C16.46',
      'CBA2-C16.47',
      'CBA2-C16.48',
      'CBA2-C16.37',
    ]),
    'designated-veteran': Object.freeze([
      'CBA2-C16.23',
      'CBA2-C16.24',
      'CBA2-C16.28',
      'CBA2-C16.29',
      'CBA2-C16.30',
      'CBA2-C16.31',
      'CBA2-C16.32',
      'CBA2-C16.39',
      'CBA2-C16.40',
      'CBA2-C16.41',
      'CBA2-C16.42',
      'CBA2-C16.43',
      'CBA2-C16.49',
      'CBA2-C16.37',
    ]),
  });

function unavailable(
  status: GovernedExtensionAvailabilityStatus,
  reasons: readonly string[]
): Extract<GovernedExtensionResult, { success: false }> {
  return Object.freeze({
    success: false as const,
    status,
    reasons: Object.freeze([...new Set(reasons)]),
  });
}

function currentChain(ledger: LifecycleEventLedger): readonly ContractEventRecord[] {
  return (
    walkChain(
      ledger.events.filter((event) => event.recordStatus === 'current')
    ) ?? []
  );
}

function latestState(
  authority: GovernedExtensionLedgerAuthority
): { ledger: LifecycleEventLedger; chain: readonly ContractEventRecord[]; state: GovernedContractState | null } {
  const ledger = createContractEventLedger(authority.currentLedger);
  const chain = currentChain(ledger);
  return { ledger, chain, state: chain.at(-1)?.resultingState ?? null };
}

function temporalInstant(
  temporal: { precision: string; value: string | null },
  label: string,
  reasons: string[]
): string | null {
  if (temporal.precision !== 'instant' || !isZonedDateTime(temporal.value)) {
    reasons.push(`${label} must be an exact governed instant with a UTC offset.`);
    return null;
  }
  return temporal.value;
}

function temporalDate(
  temporal: { precision: string; value: string | null },
  label: string,
  reasons: string[]
): string | null {
  if (temporal.precision !== 'date' || !isDateOnly(temporal.value)) {
    reasons.push(`${label} must be an exact governed date.`);
    return null;
  }
  return temporal.value;
}

function sameSourceIdentity(
  state: GovernedContractState,
  evidence: GovernedExtensionContractEvidence
): boolean {
  const source = state.source;
  const identity = evidence.sourceIdentity;
  return (
    identity.releaseId === source.releaseId &&
    identity.releaseVersion === source.releaseVersion &&
    identity.releaseDigest === source.releaseDigest &&
    identity.sourceProvider === source.sourceProvider &&
    identity.sourceRecordVersion === source.sourceRecordVersion &&
    identity.sourceObservationId === source.sourceObservationId &&
    identity.sourceArtifactSha256 === source.sourceArtifactSha256 &&
    identity.sourceContractPath === source.sourceContractPath
  );
}

function salarySeasonSet(rows: readonly { season: string }[]): string[] {
  return [...new Set(rows.map((row) => row.season))].sort();
}

function validateRetainedEvidence({
  authority,
  worldAsOfDate,
}: {
  authority: GovernedExtensionLedgerAuthority;
  worldAsOfDate: string;
}): { evidence: ReadyEvidence | null; reasons: string[]; incompatible: boolean } {
  const reasons: string[] = [];
  let incompatible = false;
  const { state } = latestState(authority);
  if (!state) {
    return {
      evidence: null,
      reasons: ['Governed Contract history is empty.'],
      incompatible: true,
    };
  }
  const contractParse = GovernedExtensionContractEvidenceZ.safeParse(
    state.terms.extensionEvidence
  );
  const leagueParse = GovernedExtensionLeagueEvidenceZ.safeParse(
    state.terms.extensionLeagueEvidence
  );
  if (!contractParse.success) {
    reasons.push(
      'Authenticated extension evidence is missing or malformed for this Contract.'
    );
  }
  if (!leagueParse.success) {
    reasons.push(
      'Retained league calendar, Salary Cap, and EAPS evidence is missing or malformed for this extension.'
    );
  }
  if (!contractParse.success || !leagueParse.success) {
    return { evidence: null, reasons, incompatible };
  }
  const contract = contractParse.data;
  const league = leagueParse.data;
  if (contract.status === 'conflicting' || league.status === 'conflicting') {
    reasons.push('Extension evidence is contradictory and cannot govern a transaction.');
    incompatible = true;
  } else if (
    !['known', 'derived'].includes(contract.status) ||
    !['known', 'derived'].includes(league.status)
  ) {
    reasons.push('Extension evidence is not complete enough to govern a transaction.');
  }
  if (!sameSourceIdentity(state, contract)) {
    reasons.push(
      'Extension evidence is unauthenticated because it does not match the pinned Contract source identity.'
    );
    incompatible = true;
  }
  const observedAt = temporalDate(
    contract.observedAt,
    'Extension-evidence observation',
    reasons
  );
  if (observedAt && observedAt > worldAsOfDate) {
    reasons.push('Extension evidence was observed after the Team Plan date.');
  }
  if (!contract.transactionHistoryComplete) {
    reasons.push('Complete trade and renegotiation history is required for extension eligibility.');
  }
  if (!isZonedDateTime(league.source.retrievedAt)) {
    reasons.push('The retained league artifact receipt needs an exact retrieval instant.');
  } else if (league.source.retrievedAt.slice(0, 10) > worldAsOfDate) {
    reasons.push('The retained league artifact was retrieved after the Team Plan date.');
  }
  if (league.signingSalaryCapYear !== authority.baselineSalaryCapYear) {
    reasons.push(
      `League signing-window evidence is for Salary Cap Year ${league.signingSalaryCapYear}, not the governed world year ${authority.baselineSalaryCapYear}.`
    );
  }
  const endYear = toEndYear(state.terms.endSeason);
  const firstExtendedSeason = endYear ? toSeasonCode(endYear + 1) : null;
  if (!firstExtendedSeason) {
    reasons.push('The original Contract end Season is missing or malformed.');
  } else if (league.firstExtendedSalaryCapYear !== toEndYear(firstExtendedSeason)) {
    reasons.push(
      `League financial evidence does not match first extended Season ${firstExtendedSeason}.`
    );
  }
  const stateSeasons = salarySeasonSet(
    state.terms.salaries
      .filter((row): row is ContractSalaryTerm & { season: string } => Boolean(row.season))
      .map((row) => ({ season: row.season }))
  );
  const evidenceSeasons = salarySeasonSet(contract.originalCompensation);
  if (
    stateSeasons.length !== state.terms.salaries.length ||
    JSON.stringify(stateSeasons) !== JSON.stringify(evidenceSeasons) ||
    evidenceSeasons.length !== contract.originalCompensation.length
  ) {
    reasons.push(
      'Exact original compensation bases must match every governed Contract Season without duplicates.'
    );
  }
  for (const row of contract.originalCompensation) {
    if (row.regularSalary > row.salaryExcludingIncentive) {
      reasons.push(
        `Original Regular Salary exceeds Salary excluding Incentive Compensation in ${row.season}.`
      );
    }
  }
  if (reasons.length > 0 || !firstExtendedSeason) {
    return { evidence: null, reasons, incompatible };
  }
  return {
    evidence: { state, contract, league, firstExtendedSeason },
    reasons,
    incompatible,
  };
}

function inferRoutes(evidence: ReadyEvidence): GovernedExtensionRoute[] {
  const routes: GovernedExtensionRoute[] = [];
  if (evidence.state.terms.isRookieScale) routes.push('rookie-scale');
  else routes.push('veteran');
  if (
    !evidence.state.terms.isRookieScale &&
    (evidence.contract.yearsOfServiceAtFirstExtendedSeason === 7 ||
      evidence.contract.yearsOfServiceAtFirstExtendedSeason === 8) &&
    evidence.contract.projectedQvfaAtOriginalExpiry === true &&
    evidence.contract.designatedTeamRoute !== 'ineligible'
  ) {
    routes.push('designated-veteran');
  }
  return routes;
}

export function inspectGovernedExtension({
  authority,
  worldAsOfDate,
  playerId,
  contractId,
}: Pick<
  GovernedExtensionRequest,
  'authority' | 'worldAsOfDate' | 'playerId' | 'contractId'
>): GovernedExtensionAvailability {
  const checked = validateRetainedEvidence({ authority, worldAsOfDate });
  const { state } = latestState(authority);
  const reasons = [...checked.reasons];
  if (state && (state.playerId !== playerId || state.contractId !== contractId)) {
    reasons.push('The requested player or Contract does not match governed history.');
  }
  const allowedRoutes = checked.evidence ? inferRoutes(checked.evidence) : [];
  return Object.freeze({
    status:
      reasons.length === 0
        ? 'ready'
        : checked.incompatible
          ? 'incompatible'
          : 'needs-input',
    playerId,
    contractId: state?.contractId ?? null,
    reasons: Object.freeze([...new Set(reasons)]),
    suggestedRoute:
      allowedRoutes.length === 1
        ? allowedRoutes[0]
        : allowedRoutes.includes('veteran')
          ? 'veteran'
          : allowedRoutes[0] ?? null,
    allowedRoutes: Object.freeze(allowedRoutes),
    firstExtendedSeason: checked.evidence?.firstExtendedSeason ?? null,
  });
}

export const resolveGovernedExtensionLedgerAuthority =
  resolveGovernedOptionLedgerAuthority;

function addYears(instant: string, years: number): number {
  const date = new Date(instant);
  date.setUTCFullYear(date.getUTCFullYear() + years);
  return date.getTime();
}

function totalBonuses(bonuses: readonly GovernedExtensionBonus[]): number {
  return bonuses.reduce((sum, bonus) => sum + bonus.amount, 0);
}

function bonusesById(
  bonuses: readonly GovernedExtensionBonus[],
  classification: GovernedExtensionBonus['classification']
): ReadonlyMap<string, number> {
  const result = new Map<string, number>();
  for (const bonus of bonuses) {
    if (bonus.classification !== classification) continue;
    result.set(bonus.bonusId, (result.get(bonus.bonusId) ?? 0) + bonus.amount);
  }
  return result;
}

function compensationTotal(row: GovernedExtensionCompensation): number {
  return row.salaryExcludingIncentive + totalBonuses(row.bonuses);
}

function money(value: number): number {
  return Math.round(value * 100) / 100;
}

function exceeds(value: number, ceiling: number): boolean {
  return money(value) > money(ceiling);
}

function validateBonusIds(
  row: GovernedExtensionCompensation,
  reasons: string[]
): void {
  const ids = new Set<string>();
  for (const bonus of row.bonuses) {
    if (ids.has(bonus.bonusId)) {
      reasons.push(`Bonus ${bonus.bonusId} is duplicated in ${row.season}.`);
    }
    ids.add(bonus.bonusId);
  }
}

function validateAnnualChanges(
  proposal: GovernedExtensionProposal,
  reasons: string[]
): void {
  const first = proposal.salariesByYear[0];
  const firstBonusIds = new Set(first.bonuses.map((bonus) => bonus.bonusId));
  for (let index = 1; index < proposal.salariesByYear.length; index += 1) {
    const previous = proposal.salariesByYear[index - 1];
    const current = proposal.salariesByYear[index];
    if (
      exceeds(
        Math.abs(current.salaryExcludingIncentive - previous.salaryExcludingIncentive),
        first.salaryExcludingIncentive * 0.08
      )
    ) {
      reasons.push(
        `${current.season} Salary excluding Incentive Compensation changes by more than 8% of the first extended Season base.`
      );
    }
    if (
      exceeds(
        Math.abs(current.regularSalary - previous.regularSalary),
        first.regularSalary * 0.08
      )
    ) {
      reasons.push(
        `${current.season} Regular Salary changes by more than 8% of the first extended Season base.`
      );
    }
    const currentIds = new Set(current.bonuses.map((bonus) => bonus.bonusId));
    for (const bonusId of new Set([...firstBonusIds, ...currentIds])) {
      const firstBonus = first.bonuses.find((bonus) => bonus.bonusId === bonusId);
      const previousAmount =
        previous.bonuses.find((bonus) => bonus.bonusId === bonusId)?.amount ?? 0;
      const currentAmount =
        current.bonuses.find((bonus) => bonus.bonusId === bonusId)?.amount ?? 0;
      const base = firstBonus?.amount ?? 0;
      if (exceeds(Math.abs(currentAmount - previousAmount), base * 0.08)) {
        reasons.push(
          `${current.season} bonus ${bonusId} changes by more than 8% of its own first extended Season base.`
        );
      }
    }
  }
}

function maximumAnnualSalary(
  yearsOfService: number,
  salaryCap: number,
  priorSalary: number,
  qualifiedHigherMaxPercentage: number | null
): number {
  const ordinaryPercent = yearsOfService < 7 ? 0.25 : yearsOfService < 10 ? 0.3 : 0.35;
  const percent =
    qualifiedHigherMaxPercentage !== null && yearsOfService < 7
      ? qualifiedHigherMaxPercentage / 100
      : ordinaryPercent;
  return money(Math.max(salaryCap * percent, priorSalary * 1.05));
}

function awardQualified(
  evidence: GovernedExtensionContractEvidence,
  reasons: string[]
): boolean {
  const award = evidence.awardEvidence;
  if (
    !['known', 'derived'].includes(award.status) ||
    !award.achievement ||
    !award.achievementSeason ||
    award.qualificationWindowSatisfied !== true
  ) {
    reasons.push(
      'A qualifying MVP, DPOY, or All-NBA achievement in the applicable lookback is not established.'
    );
    return false;
  }
  if (
    award.gameThresholdStatus !== 'satisfied' &&
    !(
      award.gameThresholdStatus === 'external-determination' &&
      Boolean(award.determinationId)
    )
  ) {
    reasons.push(
      'The award game threshold or an explicit injury/grievance determination is not established.'
    );
    return false;
  }
  return true;
}

function instantDayEnd(worldAsOfDate: string): number {
  return parseZonedDateTime(`${worldAsOfDate}T23:59:59-04:00`) ?? Number.NaN;
}

function rookieDeadline(firstGame: string): string {
  const date = new Date(firstGame);
  date.setUTCDate(date.getUTCDate() - 1);
  const datePart = date.toISOString().slice(0, 10);
  const offset = firstGame.slice(-6);
  return `${datePart}T18:00:00${offset}`;
}

function remainingOriginalSeasons(
  state: GovernedContractState,
  signedAt: string
): number {
  const signingYear = Number(signedAt.slice(0, 4));
  const signingMonth = Number(signedAt.slice(5, 7));
  const signingSeasonEndYear =
    signingMonth >= 7 ? signingYear + 1 : signingYear;
  return state.terms.salaries.filter((row) => {
    const endYear = toEndYear(row.season);
    return endYear !== null && endYear >= signingSeasonEndYear;
  }).length;
}

function originalCompensationBySeason(
  evidence: GovernedExtensionContractEvidence
): ReadonlyMap<string, GovernedExtensionCompensation> {
  return new Map(evidence.originalCompensation.map((row) => [row.season, row]));
}

function validateProposalShape(
  evidence: ReadyEvidence,
  proposal: GovernedExtensionProposal,
  reasons: string[]
): void {
  if (!isZonedDateTime(proposal.signedAt)) {
    reasons.push('Extension signature time must be an exact governed instant with a UTC offset.');
  }
  if (proposal.contractId !== evidence.state.contractId) {
    reasons.push('The proposal does not identify the governed Contract.');
  }
  if (proposal.salariesByYear[0]?.season !== evidence.firstExtendedSeason) {
    reasons.push(
      `The Extension must begin in ${evidence.firstExtendedSeason}, immediately after the original term.`
    );
  }
  proposal.salariesByYear.forEach((row, index) => {
    const expected = toSeasonCode(
      (toEndYear(evidence.firstExtendedSeason) ?? 0) + index
    );
    if (row.season !== expected) {
      reasons.push('Extension Seasons must be consecutive and may not overlap the original term.');
    }
    if (row.regularSalary > row.salaryExcludingIncentive) {
      reasons.push(
        `${row.season} Regular Salary exceeds Salary excluding Incentive Compensation.`
      );
    }
    validateBonusIds(row, reasons);
    const totalIncentives = totalBonuses(row.bonuses);
    const unlikelyIncentives = row.bonuses
      .filter((bonus) => bonus.classification === 'unlikely')
      .reduce((sum, bonus) => sum + bonus.amount, 0);
    if (exceeds(totalIncentives, row.regularSalary * 0.2)) {
      reasons.push(
        `${row.season} total Incentive Compensation exceeds 20% of Regular Salary.`
      );
    }
    const signingSeason = toSeasonCode(evidence.league.signingSalaryCapYear);
    const signingCompensation = evidence.contract.originalCompensation.find(
      (original) => original.season === signingSeason
    );
    const signingYearUnlikely = signingCompensation
      ? signingCompensation.bonuses
          .filter((bonus) => bonus.classification === 'unlikely')
          .reduce((sum, bonus) => sum + bonus.amount, 0)
      : 0;
    const grandfatheredFirstYearPercentage =
      signingCompensation && signingCompensation.regularSalary > 0
        ? signingYearUnlikely / signingCompensation.regularSalary
        : 0;
    const unlikelyPercentageCeiling =
      index === 0
        ? Math.max(0.15, grandfatheredFirstYearPercentage)
        : 0.15;
    if (exceeds(unlikelyIncentives, row.regularSalary * unlikelyPercentageCeiling)) {
      reasons.push(
        `${row.season} Unlikely Incentive Compensation exceeds ${(unlikelyPercentageCeiling * 100).toFixed(4)}% of Regular Salary.`
      );
    }
  });
  validateAnnualChanges(proposal, reasons);
}

function validateRookieRoute(
  evidence: ReadyEvidence,
  proposal: GovernedExtensionProposal,
  applicableMaximum: number,
  reasons: string[]
): void {
  if (!evidence.state.terms.isRookieScale) {
    reasons.push('The governed Contract is not a Rookie Scale Contract.');
  }
  const exercisedTeamOptions = evidence.state.terms.salaries.filter(
    (row) => row.option === 'TO' && row.optionUsed === true
  ).length;
  if (exercisedTeamOptions !== 2) {
    reasons.push('Both Rookie Scale Team Options must be exercised before extension.');
  }
  const moratoriumEnds = temporalInstant(
    evidence.league.moratoriumEndsAt,
    'July moratorium ending',
    reasons
  );
  const firstGame = temporalInstant(
    evidence.contract.fourthSeasonFirstGameAt,
    'Fourth-Season first game',
    reasons
  );
  const signed = parseZonedDateTime(proposal.signedAt);
  if (signed !== null && moratoriumEnds) {
    if (signed < (parseZonedDateTime(moratoriumEnds) ?? Number.POSITIVE_INFINITY)) {
      reasons.push('The Rookie Scale Extension was signed before the July moratorium ended.');
    }
  }
  if (signed !== null && firstGame) {
    const deadline = rookieDeadline(firstGame);
    if (signed > (parseZonedDateTime(deadline) ?? Number.NEGATIVE_INFINITY)) {
      reasons.push(`The Rookie Scale Extension was signed after ${deadline}.`);
    }
  }
  const remaining = remainingOriginalSeasons(evidence.state, proposal.signedAt);
  if (remaining + proposal.salariesByYear.length > 6) {
    reasons.push('A Rookie Scale Extension may cover no more than six aggregate Seasons from signing.');
  }
  const conditional = proposal.conditionalHigherMaxPercentage;
  if (conditional !== null) {
    if (conditional < 25 || conditional > 30) {
      reasons.push('A conditional Higher Max percentage must be between 25% and 30%.');
    }
  }
  if (proposal.agreedDesignatedVeteranPercentage !== null) {
    reasons.push('A Rookie Scale Extension cannot use a Designated Veteran percentage election.');
  }
  if (exceeds(compensationTotal(proposal.salariesByYear[0]), applicableMaximum)) {
    reasons.push('First extended Season compensation exceeds the applicable Maximum Annual Salary.');
  }
}

function validateVeteranTiming(
  evidence: ReadyEvidence,
  proposal: GovernedExtensionProposal,
  chain: readonly ContractEventRecord[],
  reasons: string[]
): number {
  if (evidence.state.terms.isRookieScale) {
    reasons.push('A Rookie Scale Contract must use the Rookie Scale Extension route.');
  }
  const originalTerm = evidence.state.terms.contractLength;
  const originalSignedAt = temporalInstant(
    evidence.contract.originalSignedAt,
    'Original Contract signature',
    reasons
  );
  if (!originalTerm || originalTerm < 3 || originalTerm > 6) {
    reasons.push('Only a three- through six-Season Veteran Contract is extendable on this route.');
  } else if (originalSignedAt && isZonedDateTime(proposal.signedAt)) {
    const anniversary = originalTerm <= 4 ? 2 : 3;
    if ((parseZonedDateTime(proposal.signedAt) ?? 0) < addYears(originalSignedAt, anniversary)) {
      reasons.push(
        `This Contract cannot be extended before its ${anniversary === 2 ? 'second' : 'third'} anniversary.`
      );
    }
  }
  const remaining = remainingOriginalSeasons(evidence.state, proposal.signedAt);
  if (remaining > 1) {
    const firstDay = temporalDate(
      evidence.league.regularSeasonFirstDay,
      'Regular Season first day',
      reasons
    );
    if (firstDay && proposal.signedAt.slice(0, 10) >= firstDay) {
      reasons.push('A Veteran Extension with more than one Season remaining is limited to the offseason.');
    }
  }
  if (chain.some((event) => event.eventKind === 'eto-exercise')) {
    reasons.push('A Contract cannot be extended after its ETO has been exercised.');
  }
  const renegotiationAt = evidence.contract.latestRenegotiationAt;
  if (
    evidence.contract.latestRenegotiationSalaryIncreasePercent !== null &&
    evidence.contract.latestRenegotiationSalaryIncreasePercent > 10
  ) {
    const exactRenegotiation = temporalInstant(
      renegotiationAt,
      'Latest Renegotiation',
      reasons
    );
    if (
      exactRenegotiation &&
      (parseZonedDateTime(proposal.signedAt) ?? 0) < addYears(exactRenegotiation, 3)
    ) {
      reasons.push('A greater-than-10% Renegotiation creates a three-year extension waiting period.');
    }
  }
  if (evidence.contract.projectedQvfaAtOriginalExpiry !== true) {
    reasons.push('The player is not established as a projected Qualifying Veteran Free Agent at original expiry.');
  }
  const hasUnexercisedOption = evidence.state.terms.salaries.some(
    (row) => row.option !== null && row.optionUsed === null
  );
  if (
    hasUnexercisedOption &&
    proposal.salariesByYear.filter((row) => row.option === null).length < 2
  ) {
    reasons.push('An unexercised Option requires at least two added non-Option Seasons.');
  }
  return remaining;
}

function validateOriginalBonusCeilings({
  original,
  proposed,
  multiplier,
  reasons,
}: {
  original: GovernedExtensionCompensation;
  proposed: GovernedExtensionCompensation;
  multiplier: number;
  reasons: string[];
}): void {
  for (const classification of ['likely', 'unlikely'] as const) {
    const originalById = bonusesById(original.bonuses, classification);
    const proposedById = bonusesById(proposed.bonuses, classification);
    for (const bonusId of new Set([...originalById.keys(), ...proposedById.keys()])) {
      if (
        exceeds(
          proposedById.get(bonusId) ?? 0,
          (originalById.get(bonusId) ?? 0) * multiplier
        )
      ) {
        reasons.push(
          `First extended ${classification} bonus ${bonusId} exceeds ${(multiplier * 100).toFixed(1)}% of its corresponding final-original amount.`
        );
      }
    }
  }
}

function validateVeteranRoute(
  evidence: ReadyEvidence,
  proposal: GovernedExtensionProposal,
  chain: readonly ContractEventRecord[],
  applicableMaximum: number,
  reasons: string[]
): void {
  const remaining = validateVeteranTiming(evidence, proposal, chain, reasons);
  if (remaining + proposal.salariesByYear.length > 5) {
    reasons.push('An ordinary Veteran Extension may cover no more than five aggregate Seasons from signing.');
  }
  if (
    proposal.conditionalHigherMaxPercentage !== null ||
    proposal.agreedDesignatedVeteranPercentage !== null
  ) {
    reasons.push('An ordinary Veteran Extension cannot use a Higher Max or Designated Veteran percentage election.');
  }
  const originalBySeason = originalCompensationBySeason(evidence.contract);
  const final = originalBySeason.get(evidence.state.terms.endSeason ?? '');
  if (!final) {
    reasons.push('Final-original compensation bases are missing.');
    return;
  }
  const first = proposal.salariesByYear[0];
  const incentives = totalBonuses(first.bonuses);
  const ordinaryCeiling = money(Math.min(
    applicableMaximum,
    Math.max(
      final.regularSalary * 1.4,
      evidence.league.estimatedAveragePlayerSalary * 1.4 - incentives
    )
  ));
  const secondToLast = evidence.contract.originalCompensation.at(-2) ?? null;
  const averageRegular =
    evidence.contract.originalCompensation.reduce(
      (sum, row) => sum + row.regularSalary,
      0
    ) / evidence.contract.originalCompensation.length;
  const specialEligible =
    (evidence.contract.seasonsPlayedForCurrentTeam ?? 0) >= 10 &&
    Boolean(secondToLast) &&
    final.regularSalary < (secondToLast?.regularSalary ?? 0);
  const specialCeiling = specialEligible
    ? money(Math.min(
        applicableMaximum,
        Math.max(averageRegular, final.regularSalary) * 1.075
      ))
    : 0;
  const controllingCeiling = Math.max(ordinaryCeiling, specialCeiling);
  if (exceeds(first.salaryExcludingIncentive, controllingCeiling)) {
    reasons.push('First extended Salary excluding Incentive Compensation exceeds the controlling Veteran Extension ceiling.');
  }
  if (exceeds(compensationTotal(first), applicableMaximum)) {
    reasons.push('First extended Season compensation exceeds the applicable Maximum Annual Salary.');
  }
  validateOriginalBonusCeilings({
    original: final,
    proposed: first,
    multiplier: specialCeiling > ordinaryCeiling ? 1.075 : 1.4,
    reasons,
  });
}

function validateDesignatedVeteranRoute(
  evidence: ReadyEvidence,
  proposal: GovernedExtensionProposal,
  chain: readonly ContractEventRecord[],
  reasons: string[]
): void {
  const remaining = validateVeteranTiming(evidence, proposal, chain, reasons);
  const yos = evidence.contract.yearsOfServiceAtFirstExtendedSeason;
  if (yos !== 7 && yos !== 8) {
    reasons.push('A Designated Veteran Extension requires seven or eight Years of Service.');
  }
  if (
    evidence.contract.designatedTeamRoute !== 'original-team' &&
    evidence.contract.designatedTeamRoute !== 'permitted-trade-history'
  ) {
    reasons.push('The original-team or permitted trade-history Designated Veteran route is not established.');
  }
  awardQualified(evidence.contract, reasons);
  if (remaining + proposal.salariesByYear.length !== 6) {
    reasons.push('A Designated Veteran Extension must cover exactly six aggregate Seasons from signing.');
  }
  if (proposal.conditionalHigherMaxPercentage !== null) {
    reasons.push('A Designated Veteran Extension cannot use a Rookie Scale conditional Higher Max election.');
  }
  const percentage = proposal.agreedDesignatedVeteranPercentage;
  if (percentage === null || percentage < 30 || percentage > 35) {
    reasons.push('The agreed Designated Veteran percentage must be between 30% and 35%.');
  } else {
    const exactSalary = money(evidence.league.salaryCap * (percentage / 100));
    if (money(compensationTotal(proposal.salariesByYear[0])) !== exactSalary) {
      reasons.push('First extended Season compensation must equal the agreed percentage of that Season’s Salary Cap.');
    }
  }
  if (proposal.salariesByYear.some((row) => totalBonuses(row.bonuses) > 0)) {
    reasons.push('A Designated Veteran Extension may not include Incentive Compensation.');
  }
}

function proposalSalaryRow(
  row: GovernedExtensionProposal['salariesByYear'][number]
): ContractSalaryTerm {
  const likely = row.bonuses
    .filter((bonus) => bonus.classification === 'likely')
    .reduce((sum, bonus) => sum + bonus.amount, 0);
  const unlikely = row.bonuses
    .filter((bonus) => bonus.classification === 'unlikely')
    .reduce((sum, bonus) => sum + bonus.amount, 0);
  const capHit = row.salaryExcludingIncentive + likely;
  return {
    season: row.season,
    salary: capHit,
    capHit,
    guaranteed: row.guaranteed,
    guaranteedAmount: row.guaranteed ? capHit : 0,
    option: row.option,
    optionHolder: row.option === 'TO' ? 'team' : row.option ? 'player' : null,
    optionUsed: row.option ? null : null,
    optionDecisionDate: { precision: 'unknown', value: null, rawValue: null },
    optionDecisionDeadline: { precision: 'unknown', value: null, rawValue: null },
    optionDecisionTerms: null,
    tradeBonus: null,
    incentives: {
      likely,
      unlikely,
      criteriaEvidence: 'known',
    },
    guaranteeSchedule: [],
    voidedByExtension: false,
    voidedOn: { precision: 'unknown', value: null, rawValue: null },
  };
}

function withStateDigest(
  state: Omit<GovernedContractState, 'stateDigest'>
): GovernedContractState {
  return Object.freeze({ ...state, stateDigest: deterministicStateDigest(state) });
}

/** Evaluate and append one extension without mutating any caller-owned value. */
export function decideGovernedExtension(
  request: GovernedExtensionRequest
): GovernedExtensionResult {
  const availability = inspectGovernedExtension(request);
  if (availability.status !== 'ready') {
    return unavailable(availability.status, availability.reasons);
  }
  const parsedProposal = GovernedExtensionProposalZ.safeParse(request.proposal);
  if (!parsedProposal.success) {
    return unavailable('needs-input', [
      `Extension proposal is malformed: ${parsedProposal.error.issues[0]?.message ?? 'invalid proposal'}`,
    ]);
  }
  const proposal = parsedProposal.data;
  const checked = validateRetainedEvidence({
    authority: request.authority,
    worldAsOfDate: request.worldAsOfDate,
  });
  if (!checked.evidence) {
    return unavailable(
      checked.incompatible ? 'incompatible' : 'needs-input',
      checked.reasons
    );
  }
  const evidence = checked.evidence;
  const reasons: string[] = [];
  validateProposalShape(evidence, proposal, reasons);
  if (!availability.allowedRoutes.includes(proposal.route)) {
    reasons.push(`${proposal.route} is not an authenticated route for this Contract.`);
  }
  const signedAt = parseZonedDateTime(proposal.signedAt);
  if (signedAt !== null && signedAt > instantDayEnd(request.worldAsOfDate)) {
    reasons.push('Extension signature evidence occurs after the Team Plan date.');
  }
  if (!request.operationId.trim() || !request.authoringIdentity.trim()) {
    reasons.push('Extension provenance requires an operation identity and author identity.');
  }
  if (!isZonedDateTime(request.recordedAt)) {
    reasons.push('Extension recording time must be an exact governed instant.');
  } else if (
    signedAt !== null &&
    (parseZonedDateTime(request.recordedAt) ?? Number.NEGATIVE_INFINITY) < signedAt
  ) {
    reasons.push('Extension recording time cannot precede the signature time.');
  }
  const { ledger, chain } = latestState(request.authority);
  const originalLast = evidence.contract.originalCompensation.at(-1);
  const yos = evidence.contract.yearsOfServiceAtFirstExtendedSeason;
  if (!originalLast || yos === null) {
    reasons.push('Years of Service and final-original compensation are required.');
  }
  const higherMaxQualified =
    proposal.route === 'rookie-scale' &&
    proposal.conditionalHigherMaxPercentage !== null &&
    awardQualified(evidence.contract, []);
  const qualifiedHigherMaxPercentage = higherMaxQualified
    ? proposal.conditionalHigherMaxPercentage
    : null;
  const applicableMaximum =
    originalLast && yos !== null
      ? maximumAnnualSalary(
          yos,
          evidence.league.salaryCap,
          compensationTotal(originalLast),
          qualifiedHigherMaxPercentage
        )
      : 0;
  if (proposal.route === 'rookie-scale') {
    validateRookieRoute(evidence, proposal, applicableMaximum, reasons);
  } else if (proposal.route === 'veteran') {
    validateVeteranRoute(evidence, proposal, chain, applicableMaximum, reasons);
  } else {
    validateDesignatedVeteranRoute(evidence, proposal, chain, reasons);
  }
  if (reasons.length > 0) return unavailable('needs-input', reasons);

  const projection = projectContractStateAsOf({
    ledger,
    worldId: request.worldId,
    contractId: request.contractId,
    asOfDate: proposal.signedAt,
    salaryCapYear: request.authority.baselineSalaryCapYear,
  });
  if (
    projection.state !== 'projected' ||
    !projection.contractState ||
    !projection.manifest ||
    !projection.effectiveEvent
  ) {
    return unavailable('needs-input', [
      projection.unavailableReasons[0] ||
        projection.needsInputReasons[0] ||
        'The predecessor Contract version cannot be projected at the signature instant.',
    ]);
  }
  const extensionRows = proposal.salariesByYear.map(proposalSalaryRow);
  const salaries = [...projection.contractState.terms.salaries, ...extensionRows];
  const totalValue = salaries.reduce(
    (sum, salary) => sum + (salary.salary ?? salary.capHit ?? 0),
    0
  );
  const guaranteedValue = salaries.reduce(
    (sum, salary) =>
      sum +
      (salary.guaranteedAmount ??
        (salary.guaranteed ? (salary.salary ?? 0) : 0)),
    0
  );
  const nextVersion = projection.contractState.contractVersion + 1;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { stateDigest: _previousDigest, ...withoutDigest } =
    projection.contractState;
  const restrictedUntil =
    proposal.route === 'designated-veteran'
      ? new Date(addYears(proposal.signedAt, 1)).toISOString()
      : projection.contractState.terms.restrictions.restrictedUntil.value;
  const stateWithoutDigest: Omit<GovernedContractState, 'stateDigest'> = {
    ...withoutDigest,
    contractVersion: nextVersion,
    terms: {
      ...projection.contractState.terms,
      isExtension: true,
      endSeason: extensionRows.at(-1)?.season ?? projection.contractState.terms.endSeason,
      contractLength: salaries.length,
      totalValue,
      averageAnnualValue: Math.round(totalValue / salaries.length),
      guaranteedValue,
      guaranteedYears: salaries.filter((salary) => salary.guaranteed).length,
      salaries,
      restrictions: {
        ...projection.contractState.terms.restrictions,
        tradeRestrictions:
          proposal.route === 'designated-veteran'
            ? [
                ...projection.contractState.terms.restrictions.tradeRestrictions,
                `Designated Veteran Extension: no trade before ${restrictedUntil}`,
              ]
            : projection.contractState.terms.restrictions.tradeRestrictions,
        canBeTradedNow:
          proposal.route === 'designated-veteran'
            ? false
            : projection.contractState.terms.restrictions.canBeTradedNow,
        restrictedUntil:
          proposal.route === 'designated-veteran'
            ? {
                precision: 'instant',
                value: restrictedUntil,
                rawValue: restrictedUntil,
              }
            : projection.contractState.terms.restrictions.restrictedUntil,
        reason:
          proposal.route === 'designated-veteran'
            ? 'Designated Veteran Extension one-year trade restriction'
            : projection.contractState.terms.restrictions.reason,
      },
      freeAgency: {
        ...projection.contractState.terms.freeAgency,
        year: toEndYear(extensionRows.at(-1)?.season ?? null),
        hasOption: extensionRows.some((salary) => salary.option !== null),
        optionYear:
          extensionRows.find((salary) => salary.option !== null)?.season ?? null,
        optionType:
          extensionRows.find((salary) => salary.option !== null)?.option ?? null,
      },
      extensionHigherMax:
        proposal.route === 'rookie-scale' &&
        proposal.conditionalHigherMaxPercentage !== null
          ? {
              percentage: proposal.conditionalHigherMaxPercentage,
              status: higherMaxQualified
                ? 'qualified-at-signing'
                : 'pending',
              firstExtendedSalaryCapYear:
                evidence.league.firstExtendedSalaryCapYear,
              determinationId:
                evidence.contract.awardEvidence.determinationId,
              resolutionEventId: null,
            }
          : null,
    },
    evidence: [
      ...projection.contractState.evidence,
      encodeContractFieldEvidence({
        fieldPath: 'terms.salaries.extension',
        status: 'known',
        sourcePath: `extensionProposal:${request.operationId}`,
        transformationId: 'governed-extension-v1',
        limitationIds: [],
      }),
    ],
    completeness: { status: 'complete', reasons: [] },
  };
  const resultingState = withStateDigest(stateWithoutDigest);
  const event: ContractEventRecord = {
    eventId: `${request.contractId}:extension:${proposal.route}:v${nextVersion}`,
    eventVersion: 1,
    eventKind: 'extension',
    worldId: request.worldId,
    contractId: request.contractId,
    playerId: request.playerId,
    teamId: request.teamId,
    executedAt: proposal.signedAt,
    effectiveAt: proposal.signedAt,
    recordedAt: request.recordedAt,
    predecessorContractVersion: projection.contractVersion,
    resultingContractVersion: nextVersion,
    predecessorEventId: projection.effectiveEvent.eventId,
    sourceTransactionId: request.operationId,
    authoringIdentity: request.authoringIdentity,
    recordStatus: 'current',
    supersedesEventVersion: null,
    canonLeafIds: [...COMMON_CANON_LEAVES, ...ROUTE_CANON_LEAVES[proposal.route]],
    resultingState,
  };
  let nextLedger: LifecycleEventLedger;
  try {
    nextLedger = appendContractEvents(ledger, [event]);
  } catch (error) {
    return unavailable('incompatible', [
      error instanceof Error
        ? error.message
        : 'The immutable extension event could not be appended.',
    ]);
  }
  const ledgerPayload = toContractEventLedgerPayload(nextLedger);
  const replay = projectContractStateAsOf({
    ledger: ledgerPayload,
    worldId: request.worldId,
    contractId: request.contractId,
    asOfDate: request.recordedAt,
    salaryCapYear: request.authority.baselineSalaryCapYear,
  });
  if (
    replay.state !== 'projected' ||
    !replay.contractState ||
    !replay.manifest ||
    replay.contractState.stateDigest !== resultingState.stateDigest
  ) {
    return unavailable('incompatible', [
      'The appended extension event did not replay to its certified resulting Contract state.',
    ]);
  }
  return Object.freeze({
    success: true as const,
    route: proposal.route,
    ledger: ledgerPayload,
    event,
    contractState: resultingState,
    extensionSalaries: Object.freeze(extensionRows),
    manifest: replay.manifest,
    expectedContractLedger: Object.freeze({
      ledgerId: request.authority.currentLedger.ledgerId,
      ledgerVersion: request.authority.currentLedger.ledgerVersion,
      overlayLedgerVersion: request.authority.overlayLedgerVersion,
    }),
  });
}
