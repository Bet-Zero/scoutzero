/** Governed ordinary unclaimed waiver, buyout, and Team Salary stretch engine. */

import {
  GovernedWaiverLifecycleZ,
  GovernedWaiverProposalZ,
  type GovernedWaiverAllocation,
  type GovernedWaiverEvent,
  type GovernedWaiverLifecycle,
  type GovernedWaiverProposal,
} from '@/schemas/governedWaiver';
import type { GovernedContractState } from '@/schemas/governedContractState';
import {
  createContractEventLedger,
  walkChain,
} from '@/features/architect/utils/contractHistory';
import type { GovernedOptionLedgerAuthority } from '@/features/architect/utils/optionDecisions';
import {
  isDateOnly,
  isSupportedSalaryCapYear,
  isWithinSalaryCapYear,
  isZonedDateTime,
  parseZonedDateTime,
} from '@/features/architect/utils/governedSeason';
import {
  isEasternInstant,
  oneYearAfter,
  worldDateContainsInstant,
} from '@/features/architect/utils/offerSheets/governedOfferSheetTime';
import {
  toEndYear,
  toSeasonCode,
} from '@/features/architect/utils/seasonFormat';

export type GovernedWaiverLedgerAuthority = GovernedOptionLedgerAuthority;

export type GovernedWaiverAvailability = Readonly<{
  status: 'ready' | 'needs-input' | 'incompatible' | 'recorded';
  playerId: string;
  contractId: string | null;
  reasons: readonly string[];
}>;

export interface GovernedWaiverRequest {
  authority: GovernedWaiverLedgerAuthority;
  existingLifecycles?: readonly GovernedWaiverLifecycle[] | null;
  existingDeadCap?:
    | readonly {
        amountByYear?:
          | readonly {
              season?: string | null;
              amount?: number | string | null;
            }[]
          | null;
      }[]
    | null;
  worldId: string;
  teamId: string;
  playerId: string;
  playerName: string;
  contractId: string;
  worldAsOfDate: string;
  /** Salary Cap Year containing the Team Plan date and League receipt. */
  salaryCapYear: number;
  salaryCapAtElection: number;
  proposal: GovernedWaiverProposal;
  operationId: string;
  authoringIdentity: string;
  recordedAt: string;
}

export type GovernedWaiverResult =
  | Readonly<{
      success: true;
      lifecycle: GovernedWaiverLifecycle;
      deadCapEntry: {
        playerId: string;
        playerName: string;
        originalSalary: number;
        amountByYear: Array<{
          season: string;
          amount: number;
          isStretched: boolean;
        }>;
        waiveDate: string;
        notes: string;
        governedLifecycle: GovernedWaiverLifecycle;
      };
      contractState: GovernedContractState;
      expectedContractLedger: {
        ledgerId: string;
        ledgerVersion: number;
        overlayLedgerVersion: number | null;
      };
    }>
  | Readonly<{
      success: false;
      status: 'needs-input' | 'incompatible' | 'recorded';
      reasons: readonly string[];
    }>;

const CANON_LEAVES = Object.freeze([
  'CBA2-R01.1',
  'CBA2-R01.2',
  'CBA2-R01.4',
  'CBA2-R01.6',
  'CBA2-R01.7',
  'CBA2-R01.11',
  'CBA2-R01.12',
  'CBA2-R01.18',
  'CBA2-R02.1',
  'CBA2-R02.2',
  'CBA2-R02.4',
  'CBA2-R02.5',
  'CBA2-R02.6',
  'CBA2-R02.7',
  'CBA2-R02.8',
  'CBA2-R02.9',
  'CBA2-R04.1',
  'CBA2-R04.2',
  'CBA2-R04.3',
  'CBA2-R04.4',
  'CBA2-R04.5',
  'CBA2-R04.7',
  'CBA2-R04.9',
  'CBA2-R05.1',
  'CBA2-R05.2',
  'CBA2-R05.3',
  'CBA2-R05.4',
  'CBA2-R05.5',
  'CBA2-R05.6',
  'CBA2-R05.7',
  'CBA2-R05.8',
  'CBA2-R05.9',
  'CBA2-R05.10',
]);

function unavailable(
  status: 'needs-input' | 'incompatible' | 'recorded',
  reasons: readonly string[]
): Extract<GovernedWaiverResult, { success: false }> {
  return Object.freeze({
    success: false as const,
    status,
    reasons: Object.freeze([...new Set(reasons)]),
  });
}

function latestContractState(authority: GovernedWaiverLedgerAuthority) {
  const ledger = createContractEventLedger(authority.currentLedger);
  const chain = walkChain(
    ledger.events.filter((event) => event.recordStatus === 'current')
  );
  return {
    ledger,
    state: chain?.at(-1)?.resultingState ?? null,
  };
}

function easternInstantFromEpoch(epochMs: number): string | null {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const parts = Object.fromEntries(
    formatter
      .formatToParts(new Date(epochMs))
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value])
  );
  const milliseconds = new Date(epochMs).getUTCMilliseconds();
  const fractionalSeconds =
    milliseconds === 0 ? '' : `.${String(milliseconds).padStart(3, '0')}`;
  const localInstant = `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}${fractionalSeconds}`;
  return (
    ['-05:00', '-04:00']
      .map((offset) => `${localInstant}${offset}`)
      .find(
        (candidate) =>
          isEasternInstant(candidate) &&
          parseZonedDateTime(candidate) === epochMs
      ) ?? null
  );
}

function addExactHours(value: string, hours: number): string | null {
  const time = parseZonedDateTime(value);
  return time === null
    ? null
    : easternInstantFromEpoch(time + hours * 3_600_000);
}

export type GovernedWaiverTerminationContext = Readonly<{
  expiryAt: string;
  salaryCapYear: number;
}>;

/**
 * Resolve ordinary unclaimed termination without deriving a year from receipt
 * text. The supplied Salary Cap Year must govern the receipt, and the exact
 * 48-hour expiry either remains in that governed window or crosses once into
 * the following Salary Cap Year.
 */
export function resolveGovernedWaiverTerminationContext(
  leagueReceivedAt: unknown,
  receiptSalaryCapYear: number
): GovernedWaiverTerminationContext | null {
  if (
    !isEasternInstant(leagueReceivedAt) ||
    !isSupportedSalaryCapYear(receiptSalaryCapYear) ||
    !isWithinSalaryCapYear(leagueReceivedAt, receiptSalaryCapYear)
  ) {
    return null;
  }
  const expiryAt = addExactHours(leagueReceivedAt, 48);
  if (!expiryAt) return null;
  const salaryCapYear = [receiptSalaryCapYear, receiptSalaryCapYear + 1].find(
    (candidate) => isWithinSalaryCapYear(expiryAt, candidate)
  );
  return salaryCapYear
    ? Object.freeze({ expiryAt, salaryCapYear })
    : null;
}

function datePart(value: string): string {
  return value.slice(0, 10);
}

function julyOneFollowingSeason(season: string): string | null {
  const endYear = toEndYear(season);
  return endYear ? `${endYear}-07-01T00:00:00-04:00` : null;
}

function maxInstant(a: string, b: string): string {
  return (parseZonedDateTime(a) ?? 0) >= (parseZonedDateTime(b) ?? 0) ? a : b;
}

function distribute(total: number, weights: readonly number[]): number[] {
  if (total <= 0 || weights.length === 0) return weights.map(() => 0);
  const weightTotal = weights.reduce((sum, value) => sum + value, 0);
  if (weightTotal <= 0) return weights.map(() => 0);
  const base = weights.map((weight) =>
    Math.floor((total * weight) / weightTotal)
  );
  let remainder = total - base.reduce((sum, value) => sum + value, 0);
  for (let index = 0; remainder > 0; index = (index + 1) % base.length) {
    base[index] += 1;
    remainder -= 1;
  }
  return base;
}

function evenlyAllocate(total: number, count: number): number[] {
  if (count <= 0) return [];
  const base = Math.floor(total / count);
  const remainder = total - base * count;
  return Array.from(
    { length: count },
    (_, index) => base + (index < remainder ? 1 : 0)
  );
}

function optionExcludesContractSeason(row: {
  option: string | null;
  optionUsed: boolean | null;
}): boolean {
  return (
    ((row.option === 'PO' || row.option === 'TO') &&
      row.optionUsed === false) ||
    (row.option === 'ETO' && row.optionUsed === true)
  );
}

function formerPlayerAmountsBySeason(
  entries: GovernedWaiverRequest['existingDeadCap']
): Map<string, number> {
  const amounts = new Map<string, number>();
  for (const entry of entries ?? []) {
    for (const row of entry.amountByYear ?? []) {
      const endYear = row.season ? toEndYear(row.season) : null;
      if (!endYear) continue;
      const season = toSeasonCode(endYear);
      const amount = Number(row.amount);
      if (!Number.isFinite(amount) || amount < 0) continue;
      amounts.set(season, (amounts.get(season) ?? 0) + amount);
    }
  }
  return amounts;
}

function event(
  operationId: string,
  index: number,
  kind: GovernedWaiverEvent['eventKind'],
  effectiveAt: string,
  recordedAt: string,
  authoringIdentity: string,
  predecessorEventId: string | null,
  canonLeafIds: readonly string[]
): GovernedWaiverEvent {
  return {
    eventId: `${operationId}:${kind}`,
    eventVersion: index + 1,
    eventKind: kind,
    effectiveAt,
    recordedAt,
    predecessorEventId,
    authoringIdentity,
    canonLeafIds: [...canonLeafIds],
  };
}

function inspectState(
  authority: GovernedWaiverLedgerAuthority,
  worldId: string,
  teamId: string,
  playerId: string,
  contractId: string,
  worldAsOfDate: string,
  existingLifecycles: readonly GovernedWaiverLifecycle[] | null | undefined,
  resolvedState?: GovernedContractState | null
): {
  state: GovernedContractState | null;
  reasons: string[];
  recorded: boolean;
} {
  const reasons: string[] = [];
  let state = resolvedState ?? null;
  if (resolvedState === undefined) {
    try {
      state = latestContractState(authority).state;
    } catch (error) {
      reasons.push(
        error instanceof Error
          ? error.message
          : 'Governed Contract history could not be read.'
      );
    }
  }
  if (!state) reasons.push('The governed Contract state is missing.');
  if (state && state.contractId !== contractId)
    reasons.push(
      'The requested Contract does not match the governed Contract.'
    );
  if (state && state.playerId !== playerId)
    reasons.push('The governed Contract belongs to a different player.');
  if (state && state.teamId !== teamId)
    reasons.push('The governed Contract belongs to a different Team.');
  if (state && state.completeness.status !== 'complete')
    reasons.push(...state.completeness.reasons);
  if (!worldId.trim()) reasons.push('A saved Team Plan is required.');
  if (!isDateOnly(worldAsOfDate) && !isZonedDateTime(worldAsOfDate))
    reasons.push('The Team Plan needs an exact governed date.');
  const recorded = (existingLifecycles ?? []).some(
    (entry) => entry.contractId === contractId && entry.playerId === playerId
  );
  return { state, reasons, recorded };
}

export function inspectGovernedWaiver({
  authority,
  existingLifecycles,
  worldId,
  teamId,
  playerId,
  contractId,
  worldAsOfDate,
  resolvedState,
}: Pick<
  GovernedWaiverRequest,
  | 'authority'
  | 'existingLifecycles'
  | 'worldId'
  | 'teamId'
  | 'playerId'
  | 'contractId'
  | 'worldAsOfDate'
> & {
  resolvedState?: GovernedContractState | null;
}): GovernedWaiverAvailability {
  const inspection = inspectState(
    authority,
    worldId,
    teamId,
    playerId,
    contractId,
    worldAsOfDate,
    existingLifecycles,
    resolvedState
  );
  if (inspection.recorded) {
    return Object.freeze({
      status: 'recorded',
      playerId,
      contractId,
      reasons: Object.freeze([
        'A waiver lifecycle is already recorded for this Contract.',
      ]),
    });
  }
  return Object.freeze({
    status: inspection.reasons.length > 0 ? 'needs-input' : 'ready',
    playerId,
    contractId: inspection.state?.contractId ?? null,
    reasons: Object.freeze(inspection.reasons),
  });
}

export function decideGovernedWaiver(
  request: GovernedWaiverRequest
): GovernedWaiverResult {
  const parsedProposal = GovernedWaiverProposalZ.safeParse(request.proposal);
  if (!parsedProposal.success) {
    return unavailable('needs-input', [
      parsedProposal.error.issues[0]?.message ?? 'Waiver terms are malformed.',
    ]);
  }
  const proposal = parsedProposal.data;
  const terminationContext = resolveGovernedWaiverTerminationContext(
    proposal.leagueReceivedAt,
    request.salaryCapYear
  );
  const inspection = inspectState(
    request.authority,
    request.worldId,
    request.teamId,
    request.playerId,
    request.contractId,
    request.worldAsOfDate,
    request.existingLifecycles
  );
  if (inspection.recorded) {
    return unavailable('recorded', [
      'A waiver lifecycle is already recorded for this Contract.',
    ]);
  }
  const reasons = [...inspection.reasons];
  const state = inspection.state;
  if (proposal.contractId !== request.contractId)
    reasons.push('The proposal Contract does not match the governed Contract.');
  if (!isEasternInstant(proposal.leagueReceivedAt))
    reasons.push(
      'League receipt must be an exact, unambiguous Eastern-time instant.'
    );
  if (
    isEasternInstant(proposal.leagueReceivedAt) &&
    !worldDateContainsInstant(request.worldAsOfDate, proposal.leagueReceivedAt)
  ) {
    reasons.push('League receipt must occur on the current Team Plan date.');
  }
  if (!isZonedDateTime(request.recordedAt))
    reasons.push('Author provenance requires an exact recorded instant.');
  if (!request.operationId.trim() || !request.authoringIdentity.trim())
    reasons.push('Operation and author identities are required.');
  if (
    !Number.isFinite(request.salaryCapAtElection) ||
    !Number.isInteger(request.salaryCapAtElection) ||
    request.salaryCapAtElection <= 0
  )
    reasons.push(
      'The governed Salary Cap in effect at election must be a positive whole-dollar amount.'
    );
  if (proposal.path === 'waive-and-stretch' && !proposal.writtenStretchElection)
    reasons.push('Waive & Stretch requires a written Team Salary election.');
  if (proposal.path !== 'waive-and-stretch' && proposal.writtenStretchElection)
    reasons.push(
      'A Team Salary stretch election cannot be attached to this path.'
    );
  if (proposal.path === 'buyout') {
    if (
      !proposal.writtenBuyoutAgreement ||
      !proposal.playerSignatureRecorded ||
      !proposal.teamSignatureRecorded
    ) {
      reasons.push(
        'Buyout requires the written agreement and both signatures.'
      );
    }
  } else if (
    proposal.buyoutReduction !== 0 ||
    proposal.writtenBuyoutAgreement ||
    proposal.playerSignatureRecorded ||
    proposal.teamSignatureRecorded
  ) {
    reasons.push('Buyout terms cannot be attached to a non-buyout waiver.');
  }
  if (reasons.length > 0 || !state) return unavailable('needs-input', reasons);

  const receiptAt = proposal.leagueReceivedAt;
  if (!terminationContext) {
    return unavailable('needs-input', [
      'The exact 48-hour waiver termination and its governed Salary Cap Year could not be resolved.',
    ]);
  }
  const { expiryAt, salaryCapYear: currentSalaryCapYear } = terminationContext;
  const currentSeason = toSeasonCode(currentSalaryCapYear);
  const allRows = state.terms.salaries
    .map((row) => ({ row, endYear: toEndYear(row.season) }))
    .filter(
      (entry): entry is typeof entry & { endYear: number } =>
        typeof entry.endYear === 'number' &&
        entry.endYear >= currentSalaryCapYear
    )
    .sort((a, b) => a.endYear - b.endYear);
  if (allRows.length === 0) {
    return unavailable('needs-input', [
      `The governed Contract has no compensation schedule for ${currentSeason} or later.`,
    ]);
  }
  const contractTotal = state.terms.totalValue;
  const retainedSalaryTotal = state.terms.salaries.reduce(
    (sum, row) => sum + (Number(row.salary) || 0),
    0
  );
  if (
    contractTotal === null ||
    !Number.isFinite(contractTotal) ||
    contractTotal !== retainedSalaryTotal
  ) {
    reasons.push(
      'The retained Contract does not reconcile total Compensation to its Base Compensation schedule; bonus allocation needs authenticated input.'
    );
  }

  const protectedRows: Array<{ season: string; amount: number }> = [];
  for (const { row, endYear } of allRows) {
    if (
      row.salary === null ||
      !Number.isFinite(row.salary) ||
      !Number.isInteger(row.salary) ||
      row.salary < 0
    ) {
      reasons.push(
        `Base Compensation for ${String(row.season)} must be a nonnegative whole-dollar amount.`
      );
      continue;
    }
    if (row.capHit === null || row.capHit !== row.salary) {
      reasons.push(
        `${String(row.season)} has a Cap Hit that does not reconcile to Base Compensation; bonus treatment needs input.`
      );
    }
    if (row.incentives.likely !== 0 || row.incentives.unlikely !== 0) {
      reasons.push(
        `${String(row.season)} retains incentive compensation without complete earning criteria.`
      );
    }
    if (
      (row.option === 'PO' || row.option === 'TO') &&
      row.optionUsed === null
    ) {
      reasons.push(
        `The ${row.option} decision for ${String(row.season)} is unresolved.`
      );
      continue;
    }
    if (row.option === 'ETO' && row.optionUsed === null) {
      reasons.push(`The ETO decision for ${String(row.season)} is unresolved.`);
      continue;
    }
    if (optionExcludesContractSeason(row)) continue;
    let amount = 0;
    if (
      endYear === currentSalaryCapYear &&
      datePart(expiryAt) >= `${currentSalaryCapYear}-01-10`
    ) {
      amount = row.salary;
    } else if (row.guaranteed === false) {
      amount = 0;
    } else if (
      row.guaranteedAmount !== null &&
      Number.isFinite(row.guaranteedAmount) &&
      Number.isInteger(row.guaranteedAmount) &&
      row.guaranteedAmount >= 0
    ) {
      amount = row.guaranteedAmount;
    } else {
      reasons.push(
        `Protected Base Compensation for ${String(row.season)} must be a nonnegative whole-dollar amount.`
      );
      continue;
    }
    if (amount > row.salary) {
      reasons.push(
        `Protected Base Compensation exceeds salary for ${String(row.season)}.`
      );
      continue;
    }
    if (amount > 0)
      protectedRows.push({ season: toSeasonCode(endYear), amount });
  }
  if (reasons.length > 0) return unavailable('needs-input', reasons);
  const remainingRows = allRows.filter(
    ({ row }) => !optionExcludesContractSeason(row)
  );
  if (remainingRows.length === 0) {
    return unavailable('needs-input', [
      'The governed Contract has no remaining Contract Seasons after recorded option decisions.',
    ]);
  }

  const protectedTotal = protectedRows.reduce(
    (sum, row) => sum + row.amount,
    0
  );
  if (proposal.buyoutReduction > protectedTotal) {
    return unavailable('needs-input', [
      'The buyout reduction cannot exceed remaining protected Base Compensation.',
    ]);
  }
  const reductionByRow = distribute(
    proposal.path === 'buyout' ? proposal.buyoutReduction : 0,
    protectedRows.map((row) => row.amount)
  );
  const beforeStretch: GovernedWaiverAllocation[] = protectedRows.map(
    (row, index) => {
      const reduction = reductionByRow[index] ?? 0;
      const amount = row.amount - reduction;
      return {
        season: row.season,
        protectedBaseCompensation: row.amount,
        buyoutReduction: reduction,
        playerPayment: amount,
        teamSalary: amount,
        setOffReduction: null,
        isTeamSalaryStretched: false,
      };
    }
  );

  let allocations = [...beforeStretch];
  let stretchBranch: GovernedWaiverLifecycle['stretchBranch'] = null;
  let stretchYears: number | null = null;
  let stretchElectionAt: string | null = null;
  let reacquisitionRestrictedUntil: string | null = null;
  const finalContractEndYear = remainingRows.at(-1)?.endYear;
  const julyAfterFinal = finalContractEndYear
    ? julyOneFollowingSeason(toSeasonCode(finalContractEndYear))
    : null;
  if (!finalContractEndYear || !julyAfterFinal) {
    return unavailable('needs-input', [
      'The final Contract Season is missing.',
    ]);
  }

  if (proposal.path === 'waive-and-stretch') {
    stretchElectionAt = expiryAt;
    const controllingSeptemberOne = `${finalContractEndYear - 1}-09-01T00:00:00-04:00`;
    if (
      (parseZonedDateTime(expiryAt) ?? 0) >=
      (parseZonedDateTime(controllingSeptemberOne) ?? 0)
    ) {
      return unavailable('needs-input', [
        'The Contract must terminate and the written Team Salary stretch election must occur before September 1 preceding its final Season.',
      ]);
    }
    const monthDay = expiryAt.slice(5, 10);
    stretchBranch =
      monthDay >= '07-01' && monthDay <= '08-31'
        ? 'july-august'
        : 'september-june';
    const currentRows = beforeStretch.filter(
      (row) => row.season === currentSeason
    );
    const futureRows = beforeStretch.filter(
      (row) => (toEndYear(row.season) ?? 0) > currentSalaryCapYear
    );
    const applicable =
      stretchBranch === 'july-august' ? beforeStretch : futureRows;
    const unchanged = stretchBranch === 'july-august' ? [] : currentRows;
    const remainingSeasonCount =
      stretchBranch === 'july-august'
        ? remainingRows.length
        : remainingRows.filter((entry) => entry.endYear > currentSalaryCapYear)
            .length;
    if (remainingSeasonCount <= 0 || applicable.length === 0) {
      return unavailable('needs-input', [
        'No future protected Team Salary is eligible for the selected stretch branch.',
      ]);
    }
    stretchYears = remainingSeasonCount * 2 + 1;
    const applicableTotal = applicable.reduce(
      (sum, row) => sum + row.teamSalary,
      0
    );
    const firstStretchYear =
      stretchBranch === 'july-august'
        ? currentSalaryCapYear
        : currentSalaryCapYear + 1;
    const stretchedAmounts = evenlyAllocate(applicableTotal, stretchYears);
    const stretched = stretchedAmounts.map((amount, index) => ({
      season: toSeasonCode(firstStretchYear + index),
      protectedBaseCompensation: amount,
      buyoutReduction: 0,
      playerPayment: 0,
      teamSalary: amount,
      setOffReduction: null,
      isTeamSalaryStretched: true,
    }));
    const existing = formerPlayerAmountsBySeason(request.existingDeadCap);
    const ceiling = Math.floor(request.salaryCapAtElection * 0.15);
    for (const row of stretched) {
      if ((existing.get(row.season) ?? 0) + row.teamSalary > ceiling) {
        return unavailable('needs-input', [
          `The ${row.season} former-player Team Salary would exceed 15% of the Salary Cap in effect at election.`,
        ]);
      }
    }
    allocations = [...unchanged, ...stretched];
    reacquisitionRestrictedUntil = julyAfterFinal;
  } else if (proposal.path === 'buyout') {
    const anniversary = oneYearAfter(receiptAt);
    if (!anniversary) {
      return unavailable('needs-input', [
        'The buyout reacquisition bar could not be resolved.',
      ]);
    }
    reacquisitionRestrictedUntil = maxInstant(anniversary, julyAfterFinal);
  }

  const eventSpecs: Array<{
    kind: GovernedWaiverEvent['eventKind'];
    at: string;
    leaves: readonly string[];
  }> = [
    {
      kind: 'waiver-request',
      at: receiptAt,
      leaves: ['CBA2-R01.4', 'CBA2-R01.11', 'CBA2-R01.12'],
    },
  ];
  if (proposal.path === 'buyout') {
    eventSpecs.push({
      kind: 'buyout-agreement',
      at: receiptAt,
      leaves: ['CBA2-R05.1', 'CBA2-R05.6'],
    });
  }
  eventSpecs.push(
    {
      kind: 'waiver-expiry',
      at: expiryAt,
      leaves: ['CBA2-R01.6', 'CBA2-R01.18'],
    },
    {
      kind: 'contract-termination',
      at: expiryAt,
      leaves: ['CBA2-R01.7', 'CBA2-R02.5', 'CBA2-R02.8'],
    }
  );
  if (proposal.path === 'waive-and-stretch') {
    eventSpecs.push({
      kind: 'team-salary-stretch-election',
      at: expiryAt,
      leaves: [
        'CBA2-R04.1',
        'CBA2-R04.2',
        'CBA2-R04.3',
        'CBA2-R04.4',
        'CBA2-R04.7',
        'CBA2-R04.9',
      ],
    });
  }
  eventSpecs.push({
    kind: 'set-off-authority',
    at: expiryAt,
    leaves: [
      'CBA2-R05.2',
      'CBA2-R05.3',
      'CBA2-R05.7',
      'CBA2-R05.8',
      'CBA2-R05.9',
    ],
  });
  const events: GovernedWaiverEvent[] = [];
  for (const [index, spec] of eventSpecs.entries()) {
    events.push(
      event(
        request.operationId,
        index,
        spec.kind,
        spec.at,
        request.recordedAt,
        request.authoringIdentity,
        events.at(-1)?.eventId ?? null,
        spec.leaves
      )
    );
  }

  const currentLedger = createContractEventLedger(
    request.authority.currentLedger
  );
  const lifecycle = GovernedWaiverLifecycleZ.parse({
    lifecycleVersion: 1,
    lifecycleId: `${request.operationId}:ordinary-waiver`,
    worldId: request.worldId,
    teamId: request.teamId,
    playerId: request.playerId,
    playerName: request.playerName,
    contractId: request.contractId,
    path: proposal.path,
    leagueReceivedAt: receiptAt,
    expiresAt: expiryAt,
    terminationAt: expiryAt,
    requestIrrevocable: true,
    outcome: 'ordinary-unclaimed',
    events,
    originalContractSeasons: remainingRows.map((entry) =>
      toSeasonCode(entry.endYear)
    ),
    protectedBaseCompensation: protectedTotal,
    buyoutReduction: proposal.path === 'buyout' ? proposal.buyoutReduction : 0,
    buyoutAgreementAt: proposal.path === 'buyout' ? receiptAt : null,
    playerSignatureRecorded: proposal.playerSignatureRecorded,
    teamSignatureRecorded: proposal.teamSignatureRecorded,
    stretchElectionAt,
    stretchBranch,
    stretchYears,
    salaryCapAtElection:
      proposal.path === 'waive-and-stretch'
        ? request.salaryCapAtElection
        : null,
    formerPlayerCeilingAtElection:
      proposal.path === 'waive-and-stretch'
        ? Math.floor(request.salaryCapAtElection * 0.15)
        : null,
    allocationsBeforeStretch: beforeStretch,
    allocations,
    paymentAllocations: beforeStretch,
    setOffStatus: 'needs-authenticated-earnings',
    setOffFormula:
      'NBA: 50% of the positive excess over the applicable zero- or one-YOS Minimum; non-NBA and successive/deferred branches require their authenticated inputs.',
    originalContractEndsAt: `${julyAfterFinal.slice(0, 4)}-06-30T23:59:59-04:00`,
    reacquisitionRestrictedUntil,
    contractAuthority: {
      ledgerId: currentLedger.ledgerId,
      ledgerVersion: currentLedger.ledgerVersion,
      stateDigest: state.stateDigest,
    },
    canonLeafIds: CANON_LEAVES,
  });
  const totalTeamSalary = allocations.reduce(
    (sum, row) => sum + row.teamSalary,
    0
  );
  const note =
    proposal.path === 'waive-and-stretch'
      ? `Waiver pending through ${expiryAt}; Team Salary stretch election schedules ${totalTeamSalary.toLocaleString('en-US')} over ${stretchYears} years after ordinary unclaimed expiry.`
      : proposal.path === 'buyout'
        ? `Waiver pending through ${expiryAt}; written buyout reduces protected Base Compensation by ${proposal.buyoutReduction.toLocaleString('en-US')}.`
        : `Waiver pending through ${expiryAt}; the Team remains financially responsible until ordinary unclaimed expiry.`;
  return Object.freeze({
    success: true as const,
    lifecycle,
    deadCapEntry: {
      playerId: request.playerId,
      playerName: request.playerName,
      originalSalary: protectedTotal,
      // Before ordinary unclaimed expiry, the Team retains the full protected
      // schedule. Consumers project the post-buyout/stretched allocation only
      // after the termination instant recorded in governedLifecycle.
      amountByYear: beforeStretch.map((row) => ({
        season: row.season,
        amount: row.protectedBaseCompensation,
        isStretched: false,
      })),
      waiveDate: receiptAt,
      notes: note,
      governedLifecycle: lifecycle,
    },
    contractState: state,
    expectedContractLedger: {
      ledgerId: currentLedger.ledgerId,
      ledgerVersion: currentLedger.ledgerVersion,
      overlayLedgerVersion: request.authority.overlayLedgerVersion,
    },
  });
}
