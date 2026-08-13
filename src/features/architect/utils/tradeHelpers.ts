import {
  CBA_BY_YEAR,
  MATCHING_BANDS_2023,
} from '@/features/architect/utils/cbaConstants';
import {
  getSalaryMatchingResult,
  SALARY_MATCHING_TIERS,
} from '@/features/architect/utils/tradeMachine/utils/salaryMatchingRules';
export { wouldExceedHardCap } from '@/features/architect/utils/hardCapUtils';
import { isPriorYearTPE } from '@/features/architect/utils/tradeMachine/utils/tpeValidation';
import { getTeamFaExceptionBuckets } from '@/features/architect/utils/faExceptionUtils';
import { areSamePickById } from '@/features/architect/utils/tradeMachine/utils/pickIdUtils';
import { toEndYear } from './seasonFormat';
import { getTeamApronStatus as getTeamApronStatusSSoT } from '@/features/architect/utils/capUtils';
import type { TradeExceptionRecord } from '@/features/architect/utils/tradeMachine/constants/types';
import {
  isTwoWayTradePlayer,
  TWO_WAY_TRADE_MATCHING_LABEL,
} from '@/features/architect/utils/tradeMachine/utils/twoWayTradeSalary';

type NumericLike = number | string | null | undefined;
type UnknownRecord = Record<string, unknown>;

interface PickLike {
  year?: unknown;
  round?: unknown;
  via?: string | null;
  originalTeam?: string | null;
  owner?: string | null;
  isSwap?: boolean;
  swapType?: string | null;
  swapDetails?: { favorable?: string; swapWith?: string[] } | null;
  swapId?: string | null;
  swapWithTeamId?: string | null;
  resolved?: boolean;
  resolvedOwner?: string | null;
  note?: string | null;
  protection?: string | null;
  protectionMeta?: {
    type?: string;
    maxPosition?: number | null;
  } | null;
  [key: string]: unknown;
}

interface SalariesByYearEntry extends UnknownRecord {
  season?: unknown;
  capHit?: NumericLike;
  salary?: NumericLike;
  likely_bonus?: NumericLike;
  bonuses?: {
    likely?: NumericLike;
    [key: string]: unknown;
  } | null;
  incentives?: {
    likely?: NumericLike;
    [key: string]: unknown;
  } | null;
  likelyIncentives?: NumericLike;
}

interface TradeHelperContract extends UnknownRecord {
  contractType?: string | null;
  isTwoWay?: boolean;
  salariesByYear?: SalariesByYearEntry[];
}

interface TradeHelperPlayer extends UnknownRecord {
  contract?: TradeHelperContract | null;
  primaryContract?: TradeHelperContract | null;
  contractType?: string | null;
  isTwoWay?: boolean;
  salary?: NumericLike;
  bonusesByYear?: Record<string, { likely?: NumericLike } | undefined>;
  isBYC?: boolean;
  baseYearCompensation?: boolean;
  tradeKicker?: unknown;
  tradeKickerPct?: NumericLike;
  isPoisonPill?: boolean;
}

interface TradeExceptionLike extends UnknownRecord {
  expired?: boolean;
  expirationDate?: string | null;
  amount?: NumericLike;
  value?: NumericLike;
  remaining?: NumericLike;
  used?: NumericLike;
  isUsed?: boolean;
}

interface TradeCapSettingsLike extends UnknownRecord {
  salaryCap?: NumericLike;
  firstApron?: NumericLike;
  secondApron?: NumericLike;
}

interface TradeHelperTeamLike extends UnknownRecord {
  team?: UnknownRecord | null;
  salaryOut?: NumericLike;
}

interface TradeTeamEntry extends UnknownRecord {
  team?: {
    id?: unknown;
    [key: string]: unknown;
  } | null;
  sends: Array<{
    id?: unknown;
    [key: string]: unknown;
  }>;
}

interface AllowableIncomingObjectParams extends UnknownRecord {
  currentTeamSalary?: NumericLike;
  salaryOut?: NumericLike;
  secondApronStatus?: boolean;
  firstApronStatus?: boolean;
  yearKey?: NumericLike;
  tpeAmount?: NumericLike;
}

interface AllowableIncomingResult {
  ceiling: number;
  margin: number;
}

const matchBands2023 = MATCHING_BANDS_2023;
void matchBands2023;

export const getTierThresholds = (yearKey: unknown) => {
  void yearKey;
  return [
    SALARY_MATCHING_TIERS.TIER_1_THRESHOLD,
    SALARY_MATCHING_TIERS.TIER_2_THRESHOLD,
  ];
};

export const MIN_SALARY = 1_119_563;

export const getSalaryForYear = (input: unknown, year: unknown): number => {
  if (!year) return 0;

  const players = Array.isArray(input) ? input : [input];

  return players.reduce((sum: number, player: TradeHelperPlayer) => {
    let base = 0;
    let yData: SalariesByYearEntry = {};

    if (player?.contract?.salariesByYear?.length) {
      const slice =
        player.contract.salariesByYear.find(
          (entry: SalariesByYearEntry) => toEndYear(entry.season) === year
        ) ||
        player.contract.salariesByYear.find(
          (entry: SalariesByYearEntry) =>
            String(entry.season) === String(year)
        );
      if (slice) {
        yData = slice;
        base = Number(slice.capHit ?? slice.salary ?? 0) || 0;
      }
    }

    if (!base && typeof player?.salary === 'number') {
      base = player.salary;
    }

    const likely =
      (typeof yData.likely_bonus === 'number' ? yData.likely_bonus : 0) ||
      Number(yData.bonuses?.likely ?? 0) ||
      Number(yData.incentives?.likely ?? 0) ||
      Number(yData.likelyIncentives ?? 0) ||
      Number(player?.bonusesByYear?.[String(year)]?.likely ?? 0);

    return sum + base + likely;
  }, 0);
};

const DEFAULT_CAP_SETTINGS: TradeCapSettingsLike = {
  salaryCap: 141_000_000,
  firstApron: 178_132_000,
  secondApron: 188_931_000,
};

const allowedIncomingBelowFirstApron = (
  out: NumericLike,
  yearKey: unknown,
  capSettings: TradeCapSettingsLike = DEFAULT_CAP_SETTINGS
): number => {
  void yearKey;
  const result = getSalaryMatchingResult({
    teamTotalSalary: 150_000_000,
    outgoingSalary: out,
    capSettings,
    apronStatus: 'OVER_CAP',
  });
  return result.allowableIncoming;
};

export const getIncomingCeiling = (
  teamTotalSalary: NumericLike,
  salaryOut: NumericLike,
  tradeExceptions: TradeExceptionLike[] = [],
  capSettings?: TradeCapSettingsLike | null,
  yearKey: NumericLike = 2025
): number => {
  const effectiveCapSettings = capSettings || DEFAULT_CAP_SETTINGS;

  const totalSalaryNum = Number(teamTotalSalary) || 0;
  const salaryOutNum = Number(salaryOut) || 0;
  const capNum = Number(effectiveCapSettings.salaryCap) || 0;
  const firstApronNum = Number(effectiveCapSettings.firstApron) || 0;
  const secondApronNum = Number(effectiveCapSettings.secondApron) || 0;

  if (totalSalaryNum < capNum) {
    return capNum;
  }

  let ceiling = allowedIncomingBelowFirstApron(
    salaryOut,
    yearKey,
    effectiveCapSettings
  );

  if (totalSalaryNum > secondApronNum) {
    ceiling = salaryOutNum;
  } else if (totalSalaryNum > firstApronNum) {
    ceiling = salaryOutNum;
  }

  const tpeValue = (tradeExceptions || [])
    .filter(
      (tradeException) =>
        !tradeException.expired &&
        (!tradeException.expirationDate ||
          Date.parse(tradeException.expirationDate) > Date.now()) &&
        !(
          totalSalaryNum > secondApronNum &&
          isPriorYearTPE(tradeException as TradeExceptionRecord, Number(yearKey))
        )
    )
    .reduce(
      (sum, tradeException) =>
        sum +
        (Number(tradeException.remaining) ||
          (typeof tradeException.amount === 'number'
            ? tradeException.amount - Number(tradeException.used ?? 0)
            : typeof tradeException.value === 'number'
              ? tradeException.value - Number(tradeException.used ?? 0)
              : 0)),
      0
    );

  return Math.floor(ceiling + tpeValue);
};

export const getIncomingCeilingViaFaException = (
  team: TradeHelperTeamLike,
  bucketType: unknown
): number => {
  const buckets = getTeamFaExceptionBuckets((team.team || {}) as UnknownRecord);
  const bucket = buckets.find((entry) => entry.type === bucketType);
  const remaining = Number(bucket?.remaining ?? 0) || 0;
  return (Number(team.salaryOut) || 0) + remaining;
};

function _calculateAllowableIncomingObj({
  currentTeamSalary,
  salaryOut,
  secondApronStatus,
  firstApronStatus = false,
  yearKey,
  tpeAmount = 0,
}: AllowableIncomingObjectParams): AllowableIncomingResult {
  const year = String(yearKey);
  const capData = (CBA_BY_YEAR as Record<string, UnknownRecord>)[year] || {};
  const salaryCap = Number(capData.salaryCap || 0) || 0;
  const currentSalaryNum = Number(currentTeamSalary) || 0;
  const salaryOutNum = Number(salaryOut) || 0;
  const tpeAmountNum = Number(tpeAmount) || 0;

  if (currentSalaryNum < salaryCap) {
    const capSpace = salaryCap - currentSalaryNum;
    const margin = Math.max(capSpace, tpeAmountNum);
    return { ceiling: margin, margin };
  }

  let ceiling: number;
  if (secondApronStatus || firstApronStatus) {
    ceiling = salaryOutNum;
  } else {
    ceiling = allowedIncomingBelowFirstApron(salaryOut, yearKey);
  }
  if (salaryOut === 0) ceiling = 0;

  const gross = ceiling + tpeAmountNum;
  return { ceiling: gross, margin: gross - salaryOutNum };
}

export function calculateAllowableIncoming(
  params: AllowableIncomingObjectParams
): AllowableIncomingResult;
export function calculateAllowableIncoming(
  currentTeamSalary: NumericLike,
  salaryOut: NumericLike,
  incomingPlayers?: unknown,
  tradeExceptions?: TradeExceptionLike[],
  capSettings?: TradeCapSettingsLike,
  yearKey?: NumericLike
): number;
export function calculateAllowableIncoming(
  ...args: unknown[]
): AllowableIncomingResult | number {
  if (typeof args[0] === 'object' && args[0] !== null && args.length === 1) {
    return _calculateAllowableIncomingObj(args[0] as AllowableIncomingObjectParams);
  }

  const currentTeamSalary = args[0] as NumericLike;
  const salaryOut = args[1] as NumericLike;
  // args[2] is incomingPlayers (unused)
  const tradeExceptions = (args[3] || []) as TradeExceptionLike[];
  const capSettings = (args[4] || {}) as TradeCapSettingsLike;
  const yearKey = (args[5] ?? 2025) as NumericLike;

  const tpeAmount = (tradeExceptions || [])
    .filter(
      (tradeException: TradeExceptionLike) =>
        !tradeException.expired &&
        (!tradeException.expirationDate ||
          Date.parse(tradeException.expirationDate) > Date.now())
    )
    .reduce(
      (sum: number, tradeException: TradeExceptionLike) =>
        sum +
        (Number(tradeException.remaining) ||
          (typeof tradeException.amount === 'number'
            ? tradeException.amount - Number(tradeException.used ?? 0)
            : typeof tradeException.value === 'number'
              ? tradeException.value - Number(tradeException.used ?? 0)
              : 0)),
      0
    );

  const secondApronStatus =
    typeof capSettings.secondApron === 'number'
      ? Number(currentTeamSalary) > capSettings.secondApron
      : false;
  const firstApronStatus =
    typeof capSettings.firstApron === 'number'
      ? Number(currentTeamSalary) > capSettings.firstApron
      : false;

  return _calculateAllowableIncomingObj({
    currentTeamSalary,
    salaryOut,
    secondApronStatus,
    firstApronStatus,
    yearKey,
    tpeAmount,
  }).margin;
}

export const getSeasonalCashLimit = (yearKey: NumericLike): number => {
  const key = String(yearKey);
  const fallbackKey = Object.keys(CBA_BY_YEAR).pop() as string;
  return (
    ((CBA_BY_YEAR as Record<string, { cashLimit?: number }>)[key] ??
      (CBA_BY_YEAR as Record<string, { cashLimit?: number }>)[fallbackKey])
      .cashLimit || 0
  );
};

export const getApronStatus = (
  salary: NumericLike,
  {
    firstApron,
    secondApron,
    salaryCap,
  }: TradeCapSettingsLike = {}
): '2nd Apron' | '1st Apron' | 'Below Aprons' => {
  const status = getTeamApronStatusSSoT(
    { totalSalary: salary },
    { firstApron, secondApron, salaryCap: salaryCap || 0 }
  );

  switch (status) {
    case 'SECOND_APRON':
      return '2nd Apron';
    case 'FIRST_APRON':
      return '1st Apron';
    default:
      return 'Below Aprons';
  }
};

export const areSamePick = (a: unknown, b: unknown): boolean =>
  areSamePickById(a, b);

export const getSwapTypeDisplay = (swapType: unknown): string => {
  return swapType === 'worst_of' ? 'Worst of' : 'Best of';
};

export const formatSwapInfo = (pick: PickLike | null | undefined): string => {
  if (!pick?.isSwap) return '';

  const type =
    pick.swapType ||
    (pick.swapDetails?.favorable === 'least' ? 'worst_of' : 'best_of');
  const swapTypeDisplay = getSwapTypeDisplay(type);
  let result = `Swap (${swapTypeDisplay})`;

  let partner = pick.swapWithTeamId || pick.swapDetails?.swapWith?.[0];

  if (!partner && pick.swapId) {
    const swapIdMatch = String(pick.swapId).match(/_swap_([A-Z]{2,3})$/);
    if (swapIdMatch) {
      partner = swapIdMatch[1];
    }
  }

  if (partner) {
    result += ` vs ${partner}`;
  }

  if (pick.resolved === true && pick.resolvedOwner) {
    result += ` → Won by ${pick.resolvedOwner}`;
  }

  return result;
};

export const formatPick = (
  pick: PickLike | null | undefined,
  options: { includeNote?: boolean } = {}
): string => {
  const { includeNote = true } = options;

  if (!pick) return '';
  let str = `${pick.year} ${pick.round} Round`;

  const viaTeam =
    pick.via ||
    (pick.originalTeam && pick.owner && pick.owner !== pick.originalTeam
      ? pick.originalTeam
      : null);

  if (viaTeam && viaTeam !== pick.owner && viaTeam !== pick.originalTeam) {
    str += ` (via ${viaTeam})`;
  }

  const protectionLabel = getProtectionDisplayLabel(pick);
  if (protectionLabel) {
    str += ` | Protected: ${protectionLabel}`;
  }

  if (pick.isSwap) {
    str += ` | ${formatSwapInfo(pick)}`;
  }
  if (includeNote && pick.note) str += ` | Note: ${pick.note}`;
  return str;
};

function getProtectionDisplayLabel(pick: PickLike | null | undefined): string {
  if (!pick) return '';

  if (pick.protectionMeta) {
    const { type, maxPosition } = pick.protectionMeta;
    switch (type) {
      case 'position':
        return maxPosition ? `Top ${maxPosition}` : '';
      case 'lottery':
        return 'Lottery';
      case 'playoff':
        return 'Playoff Protected';
      case 'always':
        return '';
      case 'never':
        return 'Unconditional';
      default:
        return '';
    }
  }

  if (
    pick.protection &&
    pick.protection !== 'Swap (+)' &&
    pick.protection !== 'Swap (-)'
  ) {
    return pick.protection;
  }

  return '';
}

export { isMeaningfulProtection } from '@/features/architect/utils/tradeMachine/utils/tradeUtilityMisc';

export const calculateTPERemaining = (
  tpe: { amount?: NumericLike },
  used: NumericLike = 0
): number => (Number(tpe.amount) || 0) - (Number(used) || 0);

export const playerFitsInTPE = (
  player: TradeHelperPlayer,
  yearKey: NumericLike,
  tpe: TradeExceptionLike | null | undefined
): boolean => {
  if (!tpe || tpe.isUsed) return false;

  const salary = getSalaryForYear(player, yearKey);

  const now = Date.now();
  const expiration = tpe.expirationDate
    ? Date.parse(tpe.expirationDate)
    : Infinity;

  return salary <= (Number(tpe.amount) || 0) && now < expiration;
};

export const formatCurrency = (val: unknown): string =>
  typeof val === 'number' ? `$${val.toLocaleString()}` : '-';

export const generateTradeId = (teams: TradeTeamEntry[]): string =>
  teams
    .map(
      (team) =>
        `${team.team?.id}:${team.sends
          .map((player) => player.id)
          .sort()
          .join(',')}`
    )
    .join('|');

export const getPlayerAdjustmentTypes = (player: TradeHelperPlayer): string[] => {
  if (!player) return [];

  if (isTwoWayTradePlayer(player)) {
    return [TWO_WAY_TRADE_MATCHING_LABEL];
  }

  const adjustmentTypes: string[] = [];

  if (player.isBYC === true || player.baseYearCompensation === true) {
    adjustmentTypes.push('BYC');
  }

  if (player.tradeKicker || Number(player.tradeKickerPct) > 0) {
    adjustmentTypes.push('Trade Kicker');
  }

  if (player.isPoisonPill === true) {
    adjustmentTypes.push('Poison Pill');
  }

  return adjustmentTypes;
};

export const getAdjustmentTooltipLabel = (
  player: TradeHelperPlayer
): string => {
  const types = getPlayerAdjustmentTypes(player);
  return types.length > 0
    ? types.join(', ')
    : 'Adjusted trade matching value (BYC/kicker/poison pill may apply)';
};
