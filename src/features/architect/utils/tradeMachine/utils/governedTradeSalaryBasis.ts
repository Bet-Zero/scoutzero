import {
  teamSoftwareSeason,
  softwareSeasonRegistry,
} from '../../governedSeason/softwareSeasonContext';
import {
  ContractEventLedgerPayloadZ,
  type ContractEventLedgerPayload,
} from '@/schemas/contractEventLedger';
import type {
  ContractSalaryTerm,
  GovernedContractState,
} from '@/schemas/governedContractState';
import {
  GovernedTradeSalaryBasisEvidenceZ,
  GovernedTradeSalaryBasisZ,
  type GovernedTradeSalaryBasis,
} from '@/schemas/governedTradeSalaryBasis';
import {
  createContractEventLedger,
  projectContractStateAsOf,
  type LifecycleProjectionManifest,
} from '@/features/architect/utils/contractHistory';
import { listWorldContractBaselines } from '@/features/architect/utils/contractSource/worldContractBaseline';
import { resolveContractBaselineWorldCompatibility } from '@/features/architect/utils/contractSource/contractSourceRelease';
import { resolveGovernedOptionLedgerAuthority } from '@/features/architect/utils/optionDecisions';
import {
  isDateOnly,
  isZonedDateTime,
  resolveGovernedSeasonEnvelope,
  type GovernedCalendarResolution,
} from '@/features/architect/utils/governedSeason';
import {
  toSeasonCode,
  toEndYear,
} from '@/features/architect/utils/seasonFormat';
import { getWorldMetadata } from '@/features/architect/utils/worldManager.core';
import { getLeague } from '@/features/architect/utils/teamLoader';
import { isTwoWayTradePlayer } from './twoWayTradeSalary';

const SALARY_BASIS_LEAVES = Object.freeze([
  'CBA2-A03.1',
  'CBA2-A03.2',
  'CBA2-A03.3',
  'CBA2-A03.5',
  'CBA2-A03.6',
  'CBA2-A03.10',
  'CBA2-A03.12',
  'CBA2-A03.14',
  'CBA2-A02.14',
  'CBA2-L03.13',
  'CBA2-L03.14',
  'CBA2-C20.12',
  'CBA2-C20.11',
]);

/** CBA2-A03.14: ordinary Rookie Scale Extension percentage ceiling. */
const ORDINARY_ROOKIE_SCALE_MAX_PERCENTAGE = 0.25;
/** CBA2-A03.6: assumed Salary Cap multiplier for poison-pill calculations. */
const POISON_PILL_ASSUMED_CAP_MULTIPLIER = 1.045;

type SalaryBasisStatus = GovernedTradeSalaryBasis['status'];

type ProjectedContract = {
  state: GovernedContractState;
  manifest: LifecycleProjectionManifest;
  extensionEffectiveAt: string | null;
};

export function collectUniqueWorldContractEventLedgers(
  worldTeams: readonly unknown[]
): ReadonlyMap<string, ContractEventLedgerPayload> {
  const overlays = new Map<string, ContractEventLedgerPayload>();
  for (const team of worldTeams) {
    if (!team || typeof team !== 'object' || Array.isArray(team)) continue;
    const rawLedgers = (team as Record<string, unknown>).contractEventLedgers;
    if (rawLedgers == null) continue;
    if (!Array.isArray(rawLedgers)) {
      throw new Error(
        'A Team snapshot has malformed governed Contract history.'
      );
    }
    for (const rawOverlay of rawLedgers) {
      const overlay = ContractEventLedgerPayloadZ.parse(rawOverlay);
      if (overlays.has(overlay.ledgerId)) {
        throw new Error(
          `Governed Contract history ${overlay.ledgerId} is owned by more than one Team snapshot.`
        );
      }
      overlays.set(overlay.ledgerId, overlay);
    }
  }
  return overlays;
}

function unavailable({
  status,
  worldId,
  teamId,
  playerId,
  contractId = null,
  asOfDate,
  salaryCapYear,
  reasons,
}: {
  status: Exclude<SalaryBasisStatus, 'ready'>;
  worldId: string;
  teamId: string;
  playerId: string;
  contractId?: string | null;
  asOfDate: string;
  salaryCapYear: number;
  reasons: readonly string[];
}): GovernedTradeSalaryBasis {
  return GovernedTradeSalaryBasisZ.parse({
    authorityVersion: 1,
    status,
    worldId,
    teamId,
    playerId,
    contractId,
    asOfDate,
    salaryCapYear,
    method: null,
    currentSalary: null,
    outgoingSalary: null,
    incomingSalary: null,
    poisonPillIncomingSalary: null,
    canonLeafIds: [],
    reasons: [...new Set(reasons)],
    proof: null,
  });
}

function exactMoney(value: number | null, label: string, reasons: string[]) {
  if (value === null || !Number.isFinite(value) || value < 0) {
    reasons.push(
      `${label} is missing or invalid in governed Contract history.`
    );
    return null;
  }
  return value;
}

function protectedAmountAsOf(
  row: ContractSalaryTerm,
  asOfDate: string,
  label: string,
  reasons: string[]
): number | null {
  const salary = exactMoney(row.salary, `${label} Base Compensation`, reasons);
  const guaranteed = exactMoney(
    row.guaranteedAmount,
    `${label} protected Base Compensation`,
    reasons
  );
  if (salary === null || guaranteed === null) return null;
  if (row.guaranteed === true && guaranteed >= salary) return salary;
  if (guaranteed < salary && row.guaranteeSchedule.length === 0) {
    reasons.push(
      `${label} is not fully protected and has no authenticated protection schedule.`
    );
    return null;
  }

  let protectedAmount = guaranteed;
  for (const step of row.guaranteeSchedule) {
    const date = step.effectiveDate.value;
    if (
      (step.effectiveDate.precision !== 'date' &&
        step.effectiveDate.precision !== 'instant') ||
      !date ||
      (step.effectiveDate.precision === 'date'
        ? !isDateOnly(date)
        : !isZonedDateTime(date))
    ) {
      reasons.push(
        `${label} has a protection step without an exact governed date.`
      );
      return null;
    }
    const stepDate =
      step.effectiveDate.precision === 'instant'
        ? new Date(Date.parse(date)).toISOString().slice(0, 10)
        : date;
    if (stepDate <= asOfDate) {
      const amount = exactMoney(
        step.guaranteedAmount,
        `${label} protection step`,
        reasons
      );
      if (amount === null) return null;
      protectedAmount = Math.max(protectedAmount, amount);
    }
  }
  return Math.min(salary, protectedAmount);
}

/**
 * A Contract signed with the Minimum Exception: at most two Seasons and no
 * bonus in any Season. A team may acquire it by trade with the Minimum
 * Exception, counting $0 incoming trade salary (CBA2-C13.4, CBA2-C13.6).
 */
function isMinimumExceptionContract(terms: GovernedContractState['terms']) {
  const length = Number(terms.contractLength ?? terms.salaries.length);
  return (
    /minimum/i.test(terms.signedUsing ?? '') &&
    Number.isInteger(length) &&
    length >= 1 &&
    length <= 2 &&
    terms.salaries.length <= 2 &&
    !terms.salaries.some(hasNonzeroBonus)
  );
}

function contractSeasonsRemaining(
  terms: GovernedContractState['terms'],
  salaryCapYear: number
): { contractSeasonsRemaining?: number } {
  const remaining = terms.salaries.filter((row) => {
    const endYear = toEndYear(row.season);
    return (
      !row.voidedByExtension && endYear != null && endYear >= salaryCapYear
    );
  }).length;
  return remaining > 0 ? { contractSeasonsRemaining: remaining } : {};
}

function hasNonzeroBonus(row: ContractSalaryTerm): boolean {
  return (
    Number(row.tradeBonus ?? 0) !== 0 ||
    Number(row.incentives.likely ?? 0) !== 0 ||
    Number(row.incentives.unlikely ?? 0) !== 0
  );
}

function computePoisonPillSalary({
  projected,
  currentRow,
  evidence: rawEvidence,
  asOfInstant,
  currentSeason,
  salaryCapAtTrade,
  reasons,
  leaves,
}: {
  projected: ProjectedContract;
  currentRow: ContractSalaryTerm;
  evidence: unknown;
  asOfInstant: string;
  currentSeason: string;
  salaryCapAtTrade: number | null;
  reasons: string[];
  leaves: string[];
}): number | null {
  if (
    !projected.extensionEffectiveAt ||
    projected.state.terms.isRookieScale !== true
  ) {
    return null;
  }
  const parsed = GovernedTradeSalaryBasisEvidenceZ.safeParse(rawEvidence);
  const poison = parsed.success ? parsed.data.poisonPill : null;
  if (!poison) {
    reasons.push(
      'This Rookie Scale Extension lacks authenticated poison-pill calculation inputs.'
    );
    return null;
  }
  if (
    poison.rookieScaleExtendedUnderVii7b !== true ||
    !isZonedDateTime(poison.extensionSignedAt) ||
    !isZonedDateTime(poison.firstFollowingSalaryCapYearStartsAt)
  ) {
    reasons.push(
      'The retained poison-pill Extension identity or timing is invalid.'
    );
    return null;
  }
  if (
    poison.extensionSignedAt !== projected.extensionEffectiveAt ||
    Date.parse(asOfInstant) < Date.parse(poison.extensionSignedAt) ||
    Date.parse(asOfInstant) >=
      Date.parse(poison.firstFollowingSalaryCapYearStartsAt)
  ) {
    return null;
  }
  if (poison.originalLastSeason !== currentSeason) {
    reasons.push(
      `Poison-pill evidence identifies ${poison.originalLastSeason}, not current Season ${currentSeason}, as the last original year.`
    );
    return null;
  }

  const currentSalary = exactMoney(
    currentRow.salary,
    'Poison-pill original-term Salary',
    reasons
  );
  if (currentSalary === null) return null;
  let total = currentSalary;
  let usedPercentageBasis = false;
  for (const term of poison.extendedTerms) {
    const stateRow = projected.state.terms.salaries.find(
      (row) => row.season === term.season
    );
    if (!stateRow) {
      reasons.push(
        `Governed Contract history has no extended-term row for ${term.season}.`
      );
      return null;
    }
    let salary: number;
    if (term.salaryBasis === 'fixed') {
      if (
        term.fixedSalary === null ||
        term.salaryPercentage !== null ||
        stateRow.salary !== term.fixedSalary
      ) {
        reasons.push(
          `Fixed poison-pill Salary evidence for ${term.season} is inconsistent.`
        );
        return null;
      }
      salary = term.fixedSalary;
    } else {
      usedPercentageBasis = true;
      if (
        salaryCapAtTrade === null ||
        term.salaryPercentage === null ||
        term.fixedSalary !== null ||
        term.salaryPercentage > ORDINARY_ROOKIE_SCALE_MAX_PERCENTAGE
      ) {
        reasons.push(
          `Percentage-based poison-pill Salary for ${term.season} lacks the governed Cap or ordinary (non-Higher-Max) percentage.`
        );
        return null;
      }
      const assumedCap = salaryCapAtTrade * POISON_PILL_ASSUMED_CAP_MULTIPLIER;
      salary = assumedCap * term.salaryPercentage;
      salary = Math.min(
        salary,
        Math.max(0, term.applicableMaximumAnnualSalary - term.unlikelyBonuses)
      );
    }
    total += salary;
  }
  leaves.push('CBA2-A03.5');
  if (usedPercentageBasis) {
    leaves.push('CBA2-A03.6', 'CBA2-A03.10', 'CBA2-A03.14');
  }
  return Math.floor(total / (1 + poison.extendedTerms.length));
}

function computeReadyBasis({
  projected,
  calendar,
  worldId,
  teamId,
  playerId,
  asOfDate,
  salaryCapYear,
  salaryCapAtTrade,
}: {
  projected: ProjectedContract;
  calendar: GovernedCalendarResolution;
  worldId: string;
  teamId: string;
  playerId: string;
  asOfDate: string;
  salaryCapYear: number;
  salaryCapAtTrade: number | null;
}): GovernedTradeSalaryBasis {
  const reasons: string[] = [];
  const leaves: string[] = [];
  const season = toSeasonCode(salaryCapYear);
  const state = projected.state;
  const currentRow = state.terms.salaries.find((row) => row.season === season);
  const opening = calendar.regularSeasonOpening?.value ?? null;
  const closing = calendar.regularSeasonClosing?.value ?? null;
  const calendarRecord = calendar.record;
  if (!season || !currentRow || !opening || !closing || !calendarRecord) {
    return unavailable({
      status: 'needs-input',
      worldId,
      teamId,
      playerId,
      contractId: state.contractId,
      asOfDate,
      salaryCapYear,
      reasons: [
        'Current Contract Salary or governed Regular Season calendar is unavailable.',
      ],
    });
  }
  const currentSalary = exactMoney(
    currentRow.salary,
    `${season} Base Compensation`,
    reasons
  );
  if (hasNonzeroBonus(currentRow)) {
    reasons.push(
      `${season} has bonus compensation whose trade treatment is outside this governed tranche.`
    );
  }
  // A zero/one-YOS Minimum uplift (CBA2-C07.3) changes Apron Team Salary,
  // not the Salary used for matching. The team's books carry it, and the
  // trade moves that row with the player (tradeMinimumUplift.ts).
  if (Number(state.terms.bonuses.tradeKickerPercent ?? 0) !== 0) {
    reasons.push(
      'This Contract has a trade bonus whose allocation is outside this governed tranche.'
    );
  }
  const evidence = GovernedTradeSalaryBasisEvidenceZ.safeParse(
    state.terms.tradeSalaryBasisEvidence
  );
  let method: GovernedTradeSalaryBasis['method'] = 'ordinary-protection';
  let outgoingSalary: number | null = null;
  const twoWay = isTwoWayTradePlayer(state.terms);
  if (twoWay) {
    // A zero matching amount is a rule result, never a fabricated cash salary.
    // Authenticate the current Contract before admitting this new mixed path.
    method = 'two-way-exclusion';
    outgoingSalary = 0;
    leaves.push(
      'CBA2-A02.14',
      'CBA2-L03.13',
      'CBA2-L03.14',
      'CBA2-C20.11',
      'CBA2-C20.12'
    );
    const signed = state.terms.signingDate;
    const signingDay = signed.value?.slice(0, 10);
    if (
      !['date', 'instant'].includes(signed.precision) ||
      !signingDay ||
      !isDateOnly(signingDay)
    ) {
      reasons.push(
        'Two-Way assignment requires a governed signing date for the thirty-day restriction.'
      );
    } else if (
      Date.parse(`${asOfDate}T00:00:00Z`) <=
      Date.parse(`${signingDay}T00:00:00Z`) + 30 * 86_400_000
    ) {
      reasons.push(
        'Two-Way assignment is within thirty days of signing, or the date-only anniversary still needs exact timing.'
      );
    }
    const nextRow = state.terms.salaries.find(
      (row) =>
        row.season === toSeasonCode(salaryCapYear + 1) && !row.voidedByExtension
    );
    const endSeason = state.terms.endSeason;
    const endYear = toEndYear(endSeason);
    const startYear = toEndYear(state.terms.startSeason);
    if (
      startYear == null ||
      endYear == null ||
      startYear > salaryCapYear ||
      endYear < startYear ||
      endYear - startYear > 1
    ) {
      reasons.push(
        'A governed Two-Way Contract must cover one or two Seasons (CBA2-C20.11).'
      );
    }
    if (
      !endSeason ||
      endSeason !== toSeasonCode(endYear) ||
      endYear == null ||
      endYear < salaryCapYear ||
      endYear > salaryCapYear + 1
    ) {
      reasons.push(
        'Two-Way assignment needs the governed current Contract term ending in this or the following Salary Cap Year.'
      );
    }
    const endsThisSeason = endSeason === season;
    if (asOfDate >= opening && (endsThisSeason || !nextRow)) {
      reasons.push(
        endsThisSeason && asOfDate > closing
          ? 'An expiring Two-Way Contract cannot be assigned after the trade deadline (CBA2-L03.14).'
          : endsThisSeason
            ? 'An expiring Two-Way Contract needs the exact governed trade deadline before assignment can be admitted.'
            : 'Two-Way assignment needs governed continuing Contract terms; missing next-season terms do not establish expiry.'
      );
    }
    if (state.terms.salaries.some((row) => row.option != null)) {
      reasons.push('A Two-Way Contract cannot carry an Option Year.');
    }
  } else if (currentSalary !== null) {
    if (asOfDate >= `${salaryCapYear}-01-08` && asOfDate <= closing) {
      method = 'january-8-deemed-full';
      outgoingSalary = currentSalary;
      leaves.push('CBA2-A03.2');
    } else if (asOfDate > closing) {
      method = 'postseason-lesser-of';
      const nextSeason = toSeasonCode(salaryCapYear + 1);
      const nextRow = state.terms.salaries.find(
        (row) => row.season === nextSeason
      );
      if (!nextSeason || !nextRow) {
        reasons.push(
          `Post-season salary basis requires governed ${nextSeason ?? 'next-Season'} terms.`
        );
      } else {
        const nextSalary = exactMoney(
          nextRow.salary,
          `${nextSeason} Base Compensation`,
          reasons
        );
        const nextProtected = protectedAmountAsOf(
          nextRow,
          asOfDate,
          nextSeason,
          reasons
        );
        if (nextSalary !== null && nextProtected !== null) {
          outgoingSalary = Math.min(currentSalary, nextProtected);
          leaves.push('CBA2-A03.1', 'CBA2-A03.3');
        }
      }
    } else {
      const protectedAmount = protectedAmountAsOf(
        currentRow,
        asOfDate,
        season,
        reasons
      );
      if (protectedAmount !== null) {
        let earnedAmount = asOfDate < opening ? 0 : null;
        if (protectedAmount >= currentSalary) earnedAmount = currentSalary;
        if (earnedAmount === null && evidence.success) {
          earnedAmount =
            evidence.data.earnedBaseCompensation.find(
              (entry) => entry.season === season && entry.asOfDate === asOfDate
            )?.amount ?? null;
        }
        if (earnedAmount === null) {
          reasons.push(
            `${season} is partially protected and exact earned Base Compensation is unavailable for ${asOfDate}.`
          );
        } else {
          let reimbursement = 0;
          const isOneYearMinimum =
            state.terms.contractLength === 1 &&
            /minimum/i.test(state.terms.signedUsing ?? '');
          if (isOneYearMinimum && protectedAmount < currentSalary) {
            const minimum = evidence.success
              ? evidence.data.oneYearMinimum
              : null;
            if (!minimum?.qualifies) {
              reasons.push(
                'One-year Minimum Contract reimbursement authority is unavailable.'
              );
            } else {
              reimbursement = minimum.leagueReimbursedUnearnedPortion;
              leaves.push('CBA2-A03.12');
            }
          }
          outgoingSalary = Math.min(
            currentSalary,
            Math.max(protectedAmount, earnedAmount + reimbursement)
          );
          leaves.push('CBA2-A03.1');
        }
      }
    }
  }

  const asOfInstant = `${asOfDate}T23:59:59Z`;
  const poisonPillIncomingSalary = computePoisonPillSalary({
    projected,
    currentRow,
    evidence: state.terms.tradeSalaryBasisEvidence,
    asOfInstant,
    currentSeason: season,
    salaryCapAtTrade,
    reasons,
    leaves,
  });
  if (reasons.length > 0 || currentSalary === null || outgoingSalary === null) {
    return unavailable({
      status: 'needs-input',
      worldId,
      teamId,
      playerId,
      contractId: state.contractId,
      asOfDate,
      salaryCapYear,
      reasons,
    });
  }
  return GovernedTradeSalaryBasisZ.parse({
    authorityVersion: 1,
    status: 'ready',
    worldId,
    teamId,
    playerId,
    contractId: state.contractId,
    asOfDate,
    salaryCapYear,
    method,
    currentSalary,
    outgoingSalary,
    incomingSalary: twoWay ? 0 : currentSalary,
    poisonPillIncomingSalary,
    ...(twoWay
      ? { twoWayContractEndYear: toEndYear(state.terms.endSeason) }
      : {}),
    ...(!twoWay && isMinimumExceptionContract(state.terms)
      ? { minimumExceptionAcquisition: true }
      : {}),
    ...contractSeasonsRemaining(state.terms, salaryCapYear),
    canonLeafIds: [...new Set(leaves)],
    reasons: [],
    proof: {
      ledgerId: projected.manifest.ledger.ledgerId,
      ledgerVersion: projected.manifest.ledger.ledgerVersion,
      contractVersion: projected.manifest.resultingContractVersion,
      stateDigest: projected.manifest.resultingStateDigest,
      calendarRecordId: calendarRecord.recordId,
      calendarRecordVersion: calendarRecord.recordVersion,
      calendarSourceRecordId: calendarRecord.sourceRecordId,
      calendarSourceRecordVersion: calendarRecord.sourceRecordVersion,
    },
  });
}

export function resolveGovernedTradeSalaryBasis(input: {
  contractState: GovernedContractState;
  contractManifest: LifecycleProjectionManifest;
  extensionEffectiveAt?: string | null;
  calendar: GovernedCalendarResolution;
  worldId: string;
  teamId: string;
  playerId: string;
  asOfDate: string;
  salaryCapYear: number;
  salaryCapAtTrade?: number | null;
}): GovernedTradeSalaryBasis {
  if (!isDateOnly(input.asOfDate)) {
    throw new Error(
      'Governed Trade Machine salary basis requires a YYYY-MM-DD world date.'
    );
  }
  return computeReadyBasis({
    projected: {
      state: input.contractState,
      manifest: input.contractManifest,
      extensionEffectiveAt: input.extensionEffectiveAt ?? null,
    },
    calendar: input.calendar,
    worldId: input.worldId,
    teamId: input.teamId,
    playerId: input.playerId,
    asOfDate: input.asOfDate,
    salaryCapYear: input.salaryCapYear,
    salaryCapAtTrade: input.salaryCapAtTrade ?? null,
  });
}

export async function loadWorldGovernedTradeSalaryBasisEntries({
  worldId,
  teamId,
  rosterPlayerIds,
  worldTeams,
  worldAsOfDate,
  salaryCapYear,
}: {
  worldId: string;
  teamId: string;
  rosterPlayerIds: readonly string[];
  worldTeams?: readonly unknown[];
  worldAsOfDate: string;
  salaryCapYear: number;
}): Promise<ReadonlyMap<string, GovernedTradeSalaryBasis>> {
  if (!isDateOnly(worldAsOfDate)) {
    throw new Error(
      'Governed Trade Machine salary basis requires a YYYY-MM-DD world date.'
    );
  }
  if (!teamId.trim()) {
    throw new Error(
      'Governed Trade Machine salary basis requires a Team identity.'
    );
  }
  const [documents, metadata, resolvedWorldTeams] = await Promise.all([
    listWorldContractBaselines(worldId),
    getWorldMetadata(worldId),
    worldTeams ? Promise.resolve(worldTeams) : getLeague(worldId),
  ]);
  const compatibility = resolveContractBaselineWorldCompatibility(metadata);
  if (!compatibility.compatible) throw new Error(compatibility.message);
  const software = teamSoftwareSeason(
    resolvedWorldTeams.find((value) => {
      const team = value as { teamCode?: string; id?: string };
      return (team.teamCode ?? team.id) === teamId;
    }),
    salaryCapYear
  );
  const seasonEnvelope = resolveGovernedSeasonEnvelope({
    asOfDate: `${worldAsOfDate}T23:59:59Z`,
    salaryCapYear,
    requiredAuthority: software ? 'software-test' : 'official',
    ...(software ? { registry: softwareSeasonRegistry([software]) } : {}),
    team: { teamId, teamCode: teamId, worldId },
  });
  if (seasonEnvelope.calendar.state !== 'available') {
    throw new Error(
      seasonEnvelope.calendar.unavailableReason ||
        'Governed Regular Season calendar is unavailable.'
    );
  }
  const salaryCapResolution = seasonEnvelope.systemLevels['salary-cap'];
  const salaryCapAtTrade =
    salaryCapResolution.state === 'available'
      ? salaryCapResolution.amount
      : null;
  const overlayByLedgerId =
    collectUniqueWorldContractEventLedgers(resolvedWorldTeams);
  const projectedByPlayer = new Map<string, ProjectedContract[]>();
  const rosterPlayerIdSet = new Set(
    rosterPlayerIds.map((playerId) => playerId.trim()).filter(Boolean)
  );
  const baselineLedgers = documents.flatMap((document) => document.ledgers);
  const baselineIds = new Set(baselineLedgers.map((ledger) => ledger.ledgerId));
  const candidates: ContractEventLedgerPayload[] = [];
  for (const baseline of baselineLedgers) {
    const authority = resolveGovernedOptionLedgerAuthority({
      baselineLedger: baseline,
      overlayLedger: overlayByLedgerId.get(baseline.ledgerId),
      baselineSalaryCapYear:
        compatibility.metadata.contractBaselineSalaryCapYear,
    });
    candidates.push(authority.currentLedger);
  }
  for (const overlay of overlayByLedgerId.values()) {
    if (!baselineIds.has(overlay.ledgerId)) candidates.push(overlay);
  }

  for (const input of candidates) {
    const candidatePlayerId = input.events[0]?.playerId;
    if (!candidatePlayerId || !rosterPlayerIdSet.has(candidatePlayerId))
      continue;
    const ledger = createContractEventLedger(input);
    const contractId = ledger.events[0]?.contractId;
    if (!contractId) continue;
    const projection = projectContractStateAsOf({
      ledger,
      worldId,
      contractId,
      asOfDate: `${worldAsOfDate}T23:59:59Z`,
      salaryCapYear,
    });
    if (
      projection.state !== 'projected' ||
      !projection.contractState ||
      !projection.manifest ||
      !projection.contractState.terms.salaries.some(
        (row) => row.season === toSeasonCode(salaryCapYear)
      )
    ) {
      continue;
    }
    const extensionEffectiveAt =
      projection.consumedEvents
        .filter((event) => event.eventKind === 'extension')
        .at(-1)?.effectiveAt ?? null;
    const list = projectedByPlayer.get(projection.contractState.playerId) ?? [];
    list.push({
      state: projection.contractState,
      manifest: projection.manifest,
      extensionEffectiveAt,
    });
    projectedByPlayer.set(projection.contractState.playerId, list);
  }

  const result = new Map<string, GovernedTradeSalaryBasis>();
  for (const playerId of rosterPlayerIds) {
    const projected = projectedByPlayer.get(playerId) ?? [];
    if (projected.length !== 1) {
      result.set(
        playerId,
        unavailable({
          status: 'incompatible',
          worldId,
          teamId,
          playerId,
          asOfDate: worldAsOfDate,
          salaryCapYear,
          reasons: [
            projected.length === 0
              ? 'No governed current Contract was found for this roster player.'
              : 'More than one governed current Contract claims this roster player and Salary Cap Year.',
          ],
        })
      );
      continue;
    }
    result.set(
      playerId,
      computeReadyBasis({
        projected: projected[0],
        calendar: seasonEnvelope.calendar,
        worldId,
        teamId,
        playerId,
        asOfDate: worldAsOfDate,
        salaryCapYear,
        salaryCapAtTrade,
      })
    );
  }
  return result;
}

export function attachGovernedTradeSalaryBasisToRoster<
  TPlayer extends Record<string, unknown>,
>(
  players: readonly TPlayer[] | null | undefined,
  entries: ReadonlyMap<string, GovernedTradeSalaryBasis>
): TPlayer[] {
  return (players ?? []).map((player) => {
    const playerId = resolveTradeSalaryBasisPlayerId(player);
    const authority = entries.get(playerId);
    return authority
      ? { ...player, governedTradeSalaryBasis: authority }
      : player;
  });
}

export function resolveTradeSalaryBasisPlayerId(
  player: Record<string, unknown>
): string {
  return String(
    player.id ??
      player.player_id ??
      player.playerId ??
      (player.bio && typeof player.bio === 'object'
        ? (player.bio as Record<string, unknown>).playerId
        : '')
  ).trim();
}

export { SALARY_BASIS_LEAVES as GOVERNED_TRADE_SALARY_BASIS_LEAVES };
