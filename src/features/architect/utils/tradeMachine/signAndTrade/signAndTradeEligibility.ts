import { normalizeYearInput } from '@/features/architect/utils/tradeMachine/utils/seasonUtils.js';

export const PLAYER_CONTRACT_STATUS = Object.freeze({
  UNDER_CONTRACT: 'UNDER_CONTRACT',
  FREE_AGENT: 'FREE_AGENT',
  CAP_HOLD: 'CAP_HOLD',
  UNKNOWN: 'UNKNOWN',
} as const);

export type PlayerContractStatus =
  (typeof PLAYER_CONTRACT_STATUS)[keyof typeof PLAYER_CONTRACT_STATUS];

export type ContractStatusResult = {
  status: PlayerContractStatus;
  reasonCode: string;
  playerId: string | null;
  playerName: string | null;
  yearKey: number | string;
  endYear: number | null;
  seasonKey: string | null;
  freeAgencyYear: number | null;
  hasActiveCapHold: boolean;
  hasSeasonMatchingCapHold: boolean;
  hasSalaryForYear: boolean;
  hasFutureGuaranteedSalary: boolean;
  salaryForYear: number;
  sourceTeamMatchesPlayer: boolean;
  sourceTeamId: string | null;
  playerTeamId: string | null;
};

export type SignAndTradeEligibilityResult = {
  eligible: boolean;
  reasonCode: string;
  status: PlayerContractStatus;
  details: ContractStatusResult;
};

type SignAndTradeContext = {
  sourceTeamId?: string | null;
  worldId?: string | null;
  sourceTeamCapHolds?: Array<Record<string, any>> | null;
};

export type SignAndTradeContractValidationResult = {
  valid: boolean;
  reasonCode: string;
  reasons: string[];
  contract: Record<string, any> | null;
  activeYearSalary: number;
};

type ContractValidationOptions = {
  requireActiveYearRow?: boolean;
};

function normalizeTeamCode(value: unknown): string | null {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length === 3 ? trimmed.toUpperCase() : trimmed;
}

function resolvePlayerId(player: Record<string, any> | null | undefined) {
  if (!player) return null;
  return (
    player.playerId ||
    player.player_id ||
    player.id ||
    player.bio?.playerId ||
    null
  );
}

function resolvePlayerName(player: Record<string, any> | null | undefined) {
  if (!player) return null;
  return player.displayName || player.name || player.bio?.displayName || null;
}

function resolvePlayerTeamId(player: Record<string, any> | null | undefined) {
  if (!player) return null;
  return normalizeTeamCode(
    player.teamCode ||
      player.teamId ||
      player.teamAbbr ||
      player.team ||
      player.originTeamId ||
      player.contract?.signingTeam ||
      null
  );
}

function toFiniteNumber(value: unknown): number {
  const asNumber =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number(value)
        : NaN;
  return Number.isFinite(asNumber) ? asNumber : 0;
}

function toIntegerOrNull(value: unknown): number | null {
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number(value)
        : NaN;
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
}

function toSeasonString(endYear: number): string {
  return `${endYear - 1}-${String(endYear).slice(-2)}`;
}

function getContractRows(player: Record<string, any>) {
  const primaryRows =
    player?.contract?.salariesByYear ||
    player?.primaryContract?.salariesByYear ||
    [];
  return Array.isArray(primaryRows) ? primaryRows : [];
}

function getRowEndYear(row: Record<string, any>): number | null {
  if (!row) return null;

  if (typeof row.year === 'number' && Number.isFinite(row.year)) {
    return Math.trunc(row.year);
  }

  if (typeof row.season === 'string' && row.season.includes('-')) {
    const [start, endSuffix] = row.season.split('-');
    const startYear = Number(start);
    if (!Number.isFinite(startYear)) return null;
    if (!endSuffix) return null;
    const paddedSuffix = String(endSuffix).padStart(2, '0');
    const century = Math.floor(startYear / 100) * 100;
    const endYear = century + Number(paddedSuffix);
    return endYear > startYear ? endYear : endYear + 100;
  }

  if (typeof row.season === 'string') {
    const parsed = Number(row.season);
    if (Number.isFinite(parsed)) return Math.trunc(parsed);
  }

  return null;
}

function hasPositiveSalary(row: Record<string, any>) {
  return toFiniteNumber(row?.capHit ?? row?.salary) > 0;
}

function matchPlayerCapHold(
  hold: Record<string, any>,
  playerId: string | null,
  playerName: string | null
) {
  const holdPlayerId =
    hold.playerId || hold.player_id || hold.id || hold.player?.id || null;
  if (playerId && holdPlayerId && String(holdPlayerId) === String(playerId)) {
    return true;
  }
  const holdName = hold.playerName || hold.name || null;
  return Boolean(playerName && holdName && String(holdName) === String(playerName));
}

function isActiveCapHoldForYear(
  hold: Record<string, any>,
  seasonKey: string | null,
  endYear: number | null
) {
  const isActive = hold.active !== false && hold.isSigned !== true;
  if (!isActive) return false;

  const holdSeason = hold.season;
  if (!holdSeason) return true;

  if (seasonKey && typeof holdSeason === 'string' && holdSeason === seasonKey) {
    return true;
  }

  if (endYear != null) {
    const normalized = normalizeYearInput(holdSeason);
    if (normalized?.endYear === endYear) return true;
  }

  return false;
}

function resolveFreeAgencyYear(player: Record<string, any>): number | null {
  return toIntegerOrNull(
    player?.freeAgentYear ??
      player?.bio?.display?.freeAgentYear ??
      player?.contract?.freeAgency?.year ??
      player?.primaryContract?.freeAgency?.year ??
      null
  );
}

export function getPlayerContractStatusForYear(
  player: Record<string, any> | null | undefined,
  yearKey: number | string,
  ctx: SignAndTradeContext = {}
): ContractStatusResult {
  const normalized = normalizeYearInput(yearKey);
  const endYear = normalized?.endYear ?? null;
  const seasonKey = normalized?.seasonString ?? null;
  const capHolds = Array.isArray(ctx.sourceTeamCapHolds)
    ? ctx.sourceTeamCapHolds
    : [];

  const playerSafe = player || {};
  const playerId = resolvePlayerId(playerSafe);
  const playerName = resolvePlayerName(playerSafe);
  const sourceTeamId = normalizeTeamCode(ctx.sourceTeamId || null);
  const playerTeamId = resolvePlayerTeamId(playerSafe);

  const rows = getContractRows(playerSafe);
  const rowsWithYear = rows
    .map((row) => ({ row, endYear: getRowEndYear(row) }))
    .filter((entry) => entry.endYear != null) as Array<{
    row: Record<string, any>;
    endYear: number;
  }>;

  const salaryRowForYear = rowsWithYear.find((entry) => entry.endYear === endYear);
  const hasSalaryForYear = Boolean(salaryRowForYear && hasPositiveSalary(salaryRowForYear.row));
  const salaryForYear = salaryRowForYear
    ? toFiniteNumber(salaryRowForYear.row.capHit ?? salaryRowForYear.row.salary)
    : 0;
  const hasFutureGuaranteedSalary = rowsWithYear.some(
    (entry) => endYear != null && entry.endYear >= endYear && hasPositiveSalary(entry.row)
  );

  const matchedHolds = capHolds.filter((hold) =>
    matchPlayerCapHold(hold, playerId, playerName)
  );
  const hasActiveCapHold = matchedHolds.some((hold) => hold.active !== false && hold.isSigned !== true);
  const hasSeasonMatchingCapHold = matchedHolds.some((hold) =>
    isActiveCapHoldForYear(hold, seasonKey, endYear)
  );

  const freeAgencyYear = resolveFreeAgencyYear(playerSafe);
  const sourceTeamMatchesPlayer =
    !sourceTeamId ||
    !playerTeamId ||
    playerTeamId === sourceTeamId ||
    hasSeasonMatchingCapHold;

  if (!normalized) {
    return {
      status: PLAYER_CONTRACT_STATUS.UNKNOWN,
      reasonCode: 'INVALID_YEAR_KEY',
      playerId,
      playerName,
      yearKey,
      endYear,
      seasonKey,
      freeAgencyYear,
      hasActiveCapHold,
      hasSeasonMatchingCapHold,
      hasSalaryForYear,
      hasFutureGuaranteedSalary,
      salaryForYear,
      sourceTeamMatchesPlayer,
      sourceTeamId,
      playerTeamId,
    };
  }

  if (hasFutureGuaranteedSalary || (freeAgencyYear != null && freeAgencyYear > endYear)) {
    return {
      status: PLAYER_CONTRACT_STATUS.UNDER_CONTRACT,
      reasonCode: hasFutureGuaranteedSalary
        ? 'HAS_CURRENT_OR_FUTURE_SALARY'
        : 'FREE_AGENCY_YEAR_IN_FUTURE',
      playerId,
      playerName,
      yearKey,
      endYear,
      seasonKey,
      freeAgencyYear,
      hasActiveCapHold,
      hasSeasonMatchingCapHold,
      hasSalaryForYear,
      hasFutureGuaranteedSalary,
      salaryForYear,
      sourceTeamMatchesPlayer,
      sourceTeamId,
      playerTeamId,
    };
  }

  if (hasSeasonMatchingCapHold) {
    return {
      status: PLAYER_CONTRACT_STATUS.CAP_HOLD,
      reasonCode: 'ACTIVE_CAP_HOLD_FOR_SEASON',
      playerId,
      playerName,
      yearKey,
      endYear,
      seasonKey,
      freeAgencyYear,
      hasActiveCapHold,
      hasSeasonMatchingCapHold,
      hasSalaryForYear,
      hasFutureGuaranteedSalary,
      salaryForYear,
      sourceTeamMatchesPlayer,
      sourceTeamId,
      playerTeamId,
    };
  }

  if (freeAgencyYear != null && freeAgencyYear <= endYear) {
    return {
      status: PLAYER_CONTRACT_STATUS.FREE_AGENT,
      reasonCode: 'FREE_AGENCY_YEAR_REACHED',
      playerId,
      playerName,
      yearKey,
      endYear,
      seasonKey,
      freeAgencyYear,
      hasActiveCapHold,
      hasSeasonMatchingCapHold,
      hasSalaryForYear,
      hasFutureGuaranteedSalary,
      salaryForYear,
      sourceTeamMatchesPlayer,
      sourceTeamId,
      playerTeamId,
    };
  }

  return {
    status: PLAYER_CONTRACT_STATUS.UNKNOWN,
    reasonCode: 'UNRESOLVED_STATUS',
    playerId,
    playerName,
    yearKey,
    endYear,
    seasonKey,
    freeAgencyYear,
    hasActiveCapHold,
    hasSeasonMatchingCapHold,
    hasSalaryForYear,
    hasFutureGuaranteedSalary,
    salaryForYear,
    sourceTeamMatchesPlayer,
    sourceTeamId,
    playerTeamId,
  };
}

export function isSignAndTradeEligible({
  player,
  yearKey,
  sourceTeamId,
  worldId = null,
  sourceTeamCapHolds = [],
  allowLegacyInference = false,
}: {
  player: Record<string, any> | null | undefined;
  yearKey: number | string;
  sourceTeamId?: string | null;
  worldId?: string | null;
  sourceTeamCapHolds?: Array<Record<string, any>> | null;
  allowLegacyInference?: boolean;
}): SignAndTradeEligibilityResult {
  const details = getPlayerContractStatusForYear(player, yearKey, {
    sourceTeamId,
    worldId,
    sourceTeamCapHolds,
  });

  if (!details.sourceTeamMatchesPlayer) {
    return {
      eligible: false,
      reasonCode: 'SOURCE_TEAM_MISMATCH',
      status: details.status,
      details,
    };
  }

  if (player?.rightsRenounced === true) {
    return {
      eligible: false,
      reasonCode: 'RIGHTS_RENOUNCED',
      status: details.status,
      details,
    };
  }

  if (
    details.status !== PLAYER_CONTRACT_STATUS.FREE_AGENT &&
    details.status !== PLAYER_CONTRACT_STATUS.CAP_HOLD
  ) {
    if (allowLegacyInference && player?.signAndTrade === true) {
      const hasLegacyContractIntent = Boolean(
        player?.signAndTradeContract ||
          player?.signAndTrade?.contract ||
          player?.contract ||
          player?.contractYears != null ||
          player?.years != null ||
          player?.firstYearGuaranteed != null ||
          Array.isArray(player?.salariesByYear) ||
          Array.isArray(player?.salaries)
      );

      if (
        hasLegacyContractIntent &&
        details.reasonCode !== 'FREE_AGENCY_YEAR_IN_FUTURE'
      ) {
        return {
          eligible: true,
          reasonCode: 'ELIGIBLE_LEGACY_SIGN_AND_TRADE_PAYLOAD',
          status: details.status,
          details,
        };
      }
    }

    return {
      eligible: false,
      reasonCode: `INELIGIBLE_STATUS_${details.status}`,
      status: details.status,
      details,
    };
  }

  return {
    eligible: true,
    reasonCode:
      details.status === PLAYER_CONTRACT_STATUS.CAP_HOLD
        ? 'ELIGIBLE_CAP_HOLD'
        : 'ELIGIBLE_FREE_AGENT',
    status: details.status,
    details,
  };
}

function normalizeSalaryRowsFromByYear(
  rows: Array<Record<string, any>>,
  startEndYear: number
) {
  return rows.map((row, index) => {
    const normalizedSeason = (() => {
      if (typeof row.season === 'string' && row.season.trim()) return row.season;
      if (typeof row.year === 'number' && Number.isFinite(row.year)) {
        return toSeasonString(Math.trunc(row.year));
      }
      return toSeasonString(startEndYear + index);
    })();

    const salary = toFiniteNumber(row.salary ?? row.capHit);
    const capHit = toFiniteNumber(row.capHit ?? row.salary ?? salary);

    return {
      ...row,
      season: normalizedSeason,
      salary,
      capHit,
      guaranteed: row.guaranteed !== false,
    };
  });
}

function normalizeSalaryRowsFromLegacyArray(
  salaries: unknown[],
  startEndYear: number
) {
  return salaries.map((value, index) => {
    const salary = toFiniteNumber(value);
    return {
      season: toSeasonString(startEndYear + index),
      salary,
      capHit: salary,
      guaranteed: true,
    };
  });
}

export function normalizeSignAndTradeContractPayload(
  contractLike: Record<string, any> | null | undefined,
  yearKey: number | string
): Record<string, any> | null {
  if (!contractLike || typeof contractLike !== 'object') return null;

  const normalizedYear = normalizeYearInput(yearKey);
  const startEndYear = normalizedYear?.endYear ?? new Date().getFullYear();
  const rawRows = Array.isArray(contractLike.salariesByYear)
    ? contractLike.salariesByYear
    : null;
  const legacySalaries = Array.isArray(contractLike.salaries)
    ? contractLike.salaries
    : null;

  const salariesByYear = rawRows
    ? normalizeSalaryRowsFromByYear(rawRows, startEndYear)
    : legacySalaries
      ? normalizeSalaryRowsFromLegacyArray(legacySalaries, startEndYear)
      : [];

  if (salariesByYear.length === 0) return null;

  const contractYears = Math.max(
    1,
    toIntegerOrNull(
      contractLike.contractYears ?? contractLike.years ?? salariesByYear.length
    ) || salariesByYear.length
  );
  const firstYearGuaranteed =
    contractLike.firstYearGuaranteed ?? salariesByYear[0]?.guaranteed ?? true;

  return {
    ...contractLike,
    signAndTrade: true,
    contractType: contractLike.contractType || 'Sign & Trade',
    salariesByYear,
    contractYears,
    firstYearGuaranteed: firstYearGuaranteed !== false,
  };
}

export function resolveSignAndTradeContractPayload(
  sendOrPlayer: Record<string, any> | null | undefined,
  yearKey: number | string,
  options: { allowPlayerContractFallback?: boolean } = {}
): Record<string, any> | null {
  if (!sendOrPlayer || typeof sendOrPlayer !== 'object') return null;

  const explicit =
    sendOrPlayer.signAndTradeContract ||
    sendOrPlayer.signAndTrade?.contract ||
    null;
  const normalizedExplicit = normalizeSignAndTradeContractPayload(explicit, yearKey);
  if (normalizedExplicit) return normalizedExplicit;

  if (options.allowPlayerContractFallback) {
    const fallbackContractBase =
      sendOrPlayer.contract || sendOrPlayer.primaryContract || null;
    const fallbackContract =
      fallbackContractBase && typeof fallbackContractBase === 'object'
        ? {
            ...fallbackContractBase,
            salariesByYear:
              fallbackContractBase.salariesByYear ??
              sendOrPlayer.salariesByYear ??
              null,
            salaries: fallbackContractBase.salaries ?? sendOrPlayer.salaries ?? null,
            contractYears:
              sendOrPlayer.contractYears ??
              sendOrPlayer.years ??
              fallbackContractBase.contractYears ??
              fallbackContractBase.years,
            firstYearGuaranteed:
              sendOrPlayer.firstYearGuaranteed ??
              fallbackContractBase.firstYearGuaranteed,
          }
        : sendOrPlayer;

    return normalizeSignAndTradeContractPayload(
      fallbackContract,
      yearKey
    );
  }

  return null;
}

export function validateSignAndTradeContractPayload(
  contractLike: Record<string, any> | null | undefined,
  yearKey: number | string,
  options: ContractValidationOptions = {}
): SignAndTradeContractValidationResult {
  const requireActiveYearRow = options.requireActiveYearRow !== false;
  const contract = normalizeSignAndTradeContractPayload(contractLike, yearKey);
  if (!contract) {
    return {
      valid: false,
      reasonCode: 'MISSING_CONTRACT_PAYLOAD',
      reasons: ['S&T contract payload is required.'],
      contract: null,
      activeYearSalary: 0,
    };
  }

  const normalizedYear = normalizeYearInput(yearKey);
  const seasonKey = normalizedYear?.seasonString ?? null;
  const rows = Array.isArray(contract.salariesByYear)
    ? contract.salariesByYear
    : [];
  const activeRow = seasonKey
    ? rows.find((row) => String(row.season) === String(seasonKey))
    : rows[0];
  const activeYearSalary = toFiniteNumber(
    activeRow?.capHit ?? activeRow?.salary
  );

  const reasons: string[] = [];
  if (rows.length === 0) {
    reasons.push('S&T contract must include salariesByYear[] rows.');
  }
  if (requireActiveYearRow && !activeRow) {
    reasons.push('S&T contract must include the active trade season row.');
  }
  if (activeRow && activeYearSalary <= 0) {
    reasons.push('S&T active-year salary must be greater than 0.');
  }
  if (contract.firstYearGuaranteed === false) {
    reasons.push('S&T first year must be guaranteed.');
  }
  if (
    typeof contract.contractYears !== 'number' ||
    contract.contractYears < 3 ||
    contract.contractYears > 4
  ) {
    reasons.push('S&T contract must be 3-4 years.');
  }

  return {
    valid: reasons.length === 0,
    reasonCode: reasons.length ? 'INVALID_CONTRACT_PAYLOAD' : 'OK',
    reasons,
    contract,
    activeYearSalary,
  };
}

export function getSignAndTradeSalaryForYear(
  sendOrPlayer: Record<string, any> | null | undefined,
  yearKey: number | string,
  options: { allowPlayerContractFallback?: boolean } = {}
): number {
  const contract = resolveSignAndTradeContractPayload(sendOrPlayer, yearKey, options);
  if (!contract) return 0;

  const normalizedYear = normalizeYearInput(yearKey);
  const seasonKey = normalizedYear?.seasonString ?? null;
  const rows = Array.isArray(contract.salariesByYear)
    ? contract.salariesByYear
    : [];
  const activeRow = seasonKey
    ? rows.find((row) => String(row.season) === String(seasonKey))
    : rows[0];
  return toFiniteNumber(activeRow?.capHit ?? activeRow?.salary);
}
