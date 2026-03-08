/**
 * Engine validation utilities
 * Consolidated from: validationDecorator.js, validatorDebug.js, templateValidator.js
 */

import { performanceMonitor } from './validationPerformanceMonitor.js';
import { validationCache } from '../cache/validationCacheService.js';
import { debug } from './engineUtils.js';
import tradeDebug from './tradeDebug.js';

type ValidatorFunction<TArgs extends unknown[] = unknown[], TResult = unknown> = (
  ...args: TArgs
) => TResult;

type ValidatorMap = Record<string, ValidatorFunction>;

type WrappedValidatorMap<T extends ValidatorMap> = {
  [K in keyof T]: (...args: Parameters<T[K]>) => ReturnType<T[K]>;
};

type TrackedValidatorFunction<
  TTeam,
  TArgs extends unknown[],
  TResult,
> = (team: TTeam, ...args: TArgs) => TResult;

interface TrackedValidatorCacheConfig<TTeam, TResult> {
  getCachedResult?: (team: TTeam) => TResult | null | undefined;
  cacheResult?: (team: TTeam, result: TResult) => void;
}

interface ValidatorDebugTeamLike {
  team?: {
    teamName?: string | null;
  } | null;
  teamId?: string | null;
}

interface ValidatorDebugLogEntry {
  type: string;
  timestamp: string;
  teamName: string;
  result: unknown;
}

interface ValidatorDebugState {
  enabled: boolean;
  logs: ValidatorDebugLogEntry[];
  logValidation(
    this: ValidatorDebugState,
    type: string,
    team: ValidatorDebugTeamLike,
    result: unknown
  ): void;
  getLogs(this: ValidatorDebugState): ValidatorDebugLogEntry[];
  clearLogs(this: ValidatorDebugState): void;
}

interface TemplateRuleResult {
  passed: boolean;
  violations: string[];
  message: string;
}

function wrapValidator<T extends ValidatorMap, K extends keyof T>(
  name: K,
  validator: T[K]
): WrappedValidatorMap<T>[K] {
  return ((...args: Parameters<T[K]>) => {
    const validatorName = String(name);

    performanceMonitor.startValidation(validatorName);

    try {
      const cacheKey = `${validatorName}-${JSON.stringify(args)}`;
      const cached = validationCache.getCachedResult(
        cacheKey
      ) as ReturnType<T[K]> | null;

      if (cached) {
        debug.log(`Cache hit for ${validatorName}`);
        performanceMonitor.endValidation(validatorName);
        return cached;
      }

      debug.log(`Executing ${validatorName}`);
      const result = validator(...args);

      if (result && typeof result === 'object') {
        validationCache.cacheResult(cacheKey, result);
      }

      performanceMonitor.endValidation(validatorName);
      return result;
    } catch (error) {
      debug.error(`Error in ${validatorName}`, error);
      performanceMonitor.endValidation(validatorName);
      throw error;
    }
  }) as WrappedValidatorMap<T>[K];
}

/**
 * Wraps validators with common functionality (from validationDecorator.js)
 */
export function wrapCommonValidators<T extends ValidatorMap>(
  validators: T
): WrappedValidatorMap<T> {
  const wrapped = {} as Partial<WrappedValidatorMap<T>>;

  for (const name of Object.keys(validators) as Array<keyof T>) {
    wrapped[name] = wrapValidator(name, validators[name]);
  }

  return wrapped as WrappedValidatorMap<T>;
}

/**
 * Creates a tracked validator with caching capabilities
 */
export function createTrackedValidator<
  TTeam,
  TArgs extends unknown[],
  TResult,
>(
  validator: TrackedValidatorFunction<TTeam, TArgs, TResult>,
  cacheConfig?: TrackedValidatorCacheConfig<TTeam, TResult>
): TrackedValidatorFunction<TTeam, TArgs, TResult> {
  return (team: TTeam, ...args: TArgs) => {
    if (cacheConfig?.getCachedResult) {
      const cached = cacheConfig.getCachedResult(team);
      if (cached) {
        return cached;
      }
    }

    const result = validator(team, ...args);

    if (cacheConfig?.cacheResult && result) {
      cacheConfig.cacheResult(team, result);
    }

    return result;
  };
}

/**
 * Debug utility for trade validators (from validatorDebug.js)
 */
export const validatorDebug: ValidatorDebugState = {
  enabled: false,
  logs: [],

  logValidation(type, team, result) {
    if (!this.enabled) return;

    const log = {
      type,
      timestamp: new Date().toISOString(),
      teamName: team.team?.teamName || team.teamId || 'Unknown Team',
      result,
    };

    this.logs.push(log);
    tradeDebug.log(`Validation: ${type}`, log);
  },

  getLogs() {
    return this.logs;
  },

  clearLogs() {
    this.logs = [];
  },
};

/**
 * Template for standardized validator modules (from templateValidator.js)
 */
export function validateTemplateRule(
  /* team , tradeCtx = {} */
): TemplateRuleResult {
  const violations: string[] = [];

  return {
    passed: violations.length === 0,
    violations,
    message: violations.length > 0 ? violations[0] : 'Rule validated',
  };
}
