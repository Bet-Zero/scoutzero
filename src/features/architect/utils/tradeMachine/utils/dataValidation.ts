/**
 * FILE: dataValidation.ts
 * PURPOSE: Validate trade-related data quality and surface warnings for missing/incomplete data
 * OWNERSHIP: Trade Machine Team
 * HISTORY:
 *  - 2026-02-15: Created for Batch C — Data Model Hardening (GAP-DATA-001, GAP-DATA-002)
 *  - 2026-03-08: TM_VALIDATOR_TS_DATA_VALIDATION_E20 - Migrated authoritative helper surface to TypeScript
 * LINKS: matchingValues.js, tradeValidator.js
 *
 * This module provides utilities to validate player data required for accurate
 * trade calculations. Rather than silently falling back to defaults when data
 * is missing, it surfaces clear warnings so users understand data limitations.
 */

export const DATA_WARNING_SEVERITY = {
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info',
} as const;

export type DataWarningSeverity =
  (typeof DATA_WARNING_SEVERITY)[keyof typeof DATA_WARNING_SEVERITY];

export const DATA_WARNING_CODES = {
  BYC_MISSING_PREVIOUS_SALARY: 'BYC_MISSING_PREVIOUS_SALARY',
  SALARY_FIELD_FALLBACK: 'SALARY_FIELD_FALLBACK',
  SALARY_FIELD_MISSING: 'SALARY_FIELD_MISSING',
} as const;

export type DataWarningCode =
  (typeof DATA_WARNING_CODES)[keyof typeof DATA_WARNING_CODES];

export type TradeDataValidationYearKey = string | number;

interface DataValidationSalaryRow {
  capHit?: number | null;
}

interface DataValidationContractLike {
  salariesByYear?: DataValidationSalaryRow[] | null;
}

export interface DataValidationPlayer {
  id?: string | number | null;
  player_id?: string | number | null;
  name?: string | null;
  bio?: {
    displayName?: string | null;
  } | null;
  contract?: DataValidationContractLike | null;
  primaryContract?: DataValidationContractLike | null;
  previousSalary?: number | null;
  isBYC?: boolean;
  baseYearCompensation?: boolean;
}

export interface SalaryFieldValidationOptions {
  salarySource?: string;
  salaryValue?: number;
}

export interface DataWarning {
  code: DataWarningCode;
  message: string;
  severity: DataWarningSeverity;
  details: Record<string, unknown>;
  timestamp: number;
}

export interface TradeDataValidationSummary {
  totalPlayers: number;
  bycPlayers: number;
  bycMissingPrevSalary: number;
  salaryFallbacks: number;
  salaryMissing: number;
}

interface BaseTradeDataValidationResult {
  warnings: DataWarning[];
  summary: TradeDataValidationSummary;
}

interface CompleteTradeDataValidationResult
  extends BaseTradeDataValidationResult {
  hasIssues: boolean;
  hasErrors: boolean;
  hasWarnings: boolean;
}

export type TradeDataValidationResult =
  | BaseTradeDataValidationResult
  | CompleteTradeDataValidationResult;

function getPlayerName(player: DataValidationPlayer): string {
  return player.name || player.bio?.displayName || 'Unknown Player';
}

function getPlayerId(player: DataValidationPlayer): string | number {
  return player.id || player.player_id || 'unknown';
}

export function createDataWarning(
  code: DataWarningCode,
  message: string,
  severity: DataWarningSeverity,
  details: Record<string, unknown> = {}
): DataWarning {
  return {
    code,
    message,
    severity,
    details,
    timestamp: Date.now(),
  };
}

export function validateBYCPlayerData(
  player: DataValidationPlayer | null | undefined
): DataWarning[] {
  const warnings: DataWarning[] = [];

  if (!player) return warnings;

  const isBYC = player.isBYC || player.baseYearCompensation;

  if (isBYC) {
    const hasPreviousSalary =
      player.previousSalary !== undefined &&
      player.previousSalary !== null &&
      typeof player.previousSalary === 'number' &&
      player.previousSalary > 0;

    if (!hasPreviousSalary) {
      const playerName = getPlayerName(player);
      const playerId = getPlayerId(player);

      warnings.push(
        createDataWarning(
          DATA_WARNING_CODES.BYC_MISSING_PREVIOUS_SALARY,
          `BYC player "${playerName}" is missing previousSalary — outgoing matching value may be inaccurate`,
          DATA_WARNING_SEVERITY.WARNING,
          {
            playerId,
            playerName,
            isBYC: true,
            previousSalary: player.previousSalary,
            fallbackUsed: true,
            fallbackMethod: '50% of new salary',
            expectedField: 'previousSalary',
            cbaImplication:
              'BYC matching value = max(previousSalary, 50% of newSalary). Without previousSalary, only 50% rule can be applied.',
          }
        )
      );
    }
  }

  return warnings;
}

export function validateSalaryFieldData(
  player: DataValidationPlayer | null | undefined,
  yearKey: TradeDataValidationYearKey,
  options: SalaryFieldValidationOptions = {}
): DataWarning[] {
  const warnings: DataWarning[] = [];

  if (!player) return warnings;

  const { salarySource, salaryValue } = options;
  const playerName = getPlayerName(player);
  const playerId = getPlayerId(player);

  const contract = player.contract || player.primaryContract;
  const salariesByYear = contract?.salariesByYear || [];
  const hasCanonicalSalary =
    salariesByYear.length > 0 &&
    salariesByYear.some(
      (seasonSalary) =>
        seasonSalary.capHit !== undefined &&
        seasonSalary.capHit !== null &&
        seasonSalary.capHit > 0
    );

  if (!hasCanonicalSalary && (salaryValue ?? 0) > 0) {
    warnings.push(
      createDataWarning(
        DATA_WARNING_CODES.SALARY_FIELD_FALLBACK,
        `Player "${playerName}" using fallback salary source: ${salarySource || 'player.salary'}`,
        DATA_WARNING_SEVERITY.INFO,
        {
          playerId,
          playerName,
          salarySource: salarySource || 'fallback',
          salaryValue,
          canonicalPath: 'contract.salariesByYear[].capHit',
          year: yearKey,
        }
      )
    );
  } else if (!hasCanonicalSalary && (salaryValue ?? 0) === 0) {
    warnings.push(
      createDataWarning(
        DATA_WARNING_CODES.SALARY_FIELD_MISSING,
        `Player "${playerName}" has no salary data for year ${yearKey}`,
        DATA_WARNING_SEVERITY.WARNING,
        {
          playerId,
          playerName,
          year: yearKey,
          canonicalPath: 'contract.salariesByYear[].capHit',
        }
      )
    );
  }

  return warnings;
}

export function validateTradeData(
  players: unknown,
  yearKey: TradeDataValidationYearKey
): TradeDataValidationResult {
  const warnings: DataWarning[] = [];
  const summary: TradeDataValidationSummary = {
    totalPlayers: 0,
    bycPlayers: 0,
    bycMissingPrevSalary: 0,
    salaryFallbacks: 0,
    salaryMissing: 0,
  };

  if (!Array.isArray(players)) {
    return { warnings, summary };
  }

  summary.totalPlayers = players.length;

  players.forEach((rawPlayer) => {
    const player = rawPlayer as DataValidationPlayer;

    const bycWarnings = validateBYCPlayerData(player);
    warnings.push(...bycWarnings);

    if (player.isBYC || player.baseYearCompensation) {
      summary.bycPlayers++;
      if (bycWarnings.length > 0) {
        summary.bycMissingPrevSalary++;
      }
    }

    const salaryWarnings = validateSalaryFieldData(player, yearKey);
    warnings.push(...salaryWarnings);

    salaryWarnings.forEach((warning) => {
      if (warning.code === DATA_WARNING_CODES.SALARY_FIELD_FALLBACK) {
        summary.salaryFallbacks++;
      } else if (warning.code === DATA_WARNING_CODES.SALARY_FIELD_MISSING) {
        summary.salaryMissing++;
      }
    });
  });

  return {
    warnings,
    summary,
    hasIssues: warnings.length > 0,
    hasErrors: warnings.some(
      (warning) => warning.severity === DATA_WARNING_SEVERITY.ERROR
    ),
    hasWarnings: warnings.some(
      (warning) => warning.severity === DATA_WARNING_SEVERITY.WARNING
    ),
  };
}

export function formatDataWarning(
  warning: { message?: string | null; severity?: string | null } | null | undefined
): string {
  if (!warning) return '';

  const prefix =
    warning.severity === DATA_WARNING_SEVERITY.ERROR
      ? '❌'
      : warning.severity === DATA_WARNING_SEVERITY.WARNING
        ? '⚠️'
        : 'ℹ️';

  return `${prefix} ${warning.message}`;
}
