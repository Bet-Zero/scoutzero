import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createTrackedValidator,
  validateTemplateRule,
  validatorDebug,
  wrapCommonValidators,
} from '@/features/architect/utils/tradeMachine/engine/validationUtils';
import { performanceMonitor } from '@/features/architect/utils/tradeMachine/engine/validationPerformanceMonitor';
import { validationCache } from '@/features/architect/utils/tradeMachine/cache/validationCacheService';
import { debug } from '@/features/architect/utils/tradeMachine/engine/engineUtils';
import tradeDebug from '@/features/architect/utils/tradeMachine/engine/tradeDebug';

describe('validationUtils contract', () => {
  beforeEach(() => {
    performanceMonitor.reset();
    validationCache.clear();
    validatorDebug.enabled = false;
    validatorDebug.clearLogs();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    performanceMonitor.reset();
    validationCache.clear();
    validatorDebug.enabled = false;
    validatorDebug.clearLogs();
  });

  it('caches object-like wrapped validator results without re-executing the validator', () => {
    const validator = vi.fn((team: { teamId: string }) => ({
      passed: true,
      teamId: team.teamId,
    }));
    const wrapped = wrapCommonValidators({
      validateSalaryMatching: validator,
    });

    const first = wrapped.validateSalaryMatching({ teamId: 'BOS' });
    const metricsAfterFirst = validationCache.getMetrics();
    const second = wrapped.validateSalaryMatching({ teamId: 'BOS' });
    const metricsAfterSecond = validationCache.getMetrics();
    const report = performanceMonitor.getReport() as {
      validations: Record<string, { calls: number }>;
    };

    expect(validator).toHaveBeenCalledTimes(1);
    expect(second).toBe(first);
    expect(metricsAfterFirst.size).toBeGreaterThan(0);
    expect(metricsAfterSecond.hits).toBeGreaterThan(metricsAfterFirst.hits);
    expect(report.validations.validateSalaryMatching.calls).toBe(2);
  });

  it('does not cache primitive wrapped validator results', () => {
    const validator = vi.fn((_team: { teamId: string }) => 'primitive-result');
    const wrapped = wrapCommonValidators({
      validateCash: validator,
    });

    expect(wrapped.validateCash({ teamId: 'BOS' })).toBe('primitive-result');
    expect(wrapped.validateCash({ teamId: 'BOS' })).toBe('primitive-result');

    expect(validator).toHaveBeenCalledTimes(2);
    expect(validationCache.getMetrics().size).toBe(0);
  });

  it('ends monitoring and rethrows when a wrapped validator throws', () => {
    const thrownError = new Error('boom');
    const errorSpy = vi
      .spyOn(debug, 'error')
      .mockImplementation(() => undefined);
    const validator = vi.fn((_team: { teamId: string }) => {
      throw thrownError;
    });
    const wrapped = wrapCommonValidators({
      validateHardCap: validator,
    });

    expect(() => wrapped.validateHardCap({ teamId: 'BOS' })).toThrow(thrownError);
    expect(errorSpy).toHaveBeenCalledWith('Error in validateHardCap', thrownError);

    const report = performanceMonitor.getReport() as {
      validations: Record<string, { calls: number }>;
    };
    const monitorState = performanceMonitor as {
      startTimes: Map<string, number>;
    };

    expect(report.validations.validateHardCap.calls).toBe(1);
    expect(monitorState.startTimes.size).toBe(0);
  });

  it('short-circuits tracked validators from cache and writes through truthy results', () => {
    let cachedResult: { passed: boolean; label: string } | null = null;
    const getCachedResult = vi.fn(() => cachedResult);
    const cacheResult = vi.fn(
      (_team: { teamId: string }, result: { passed: boolean; label: string }) => {
        cachedResult = result;
      }
    );
    const validator = vi.fn((team: { teamId: string }, suffix: string) => ({
      passed: true,
      label: `${team.teamId}:${suffix}`,
    }));
    const tracked = createTrackedValidator(validator, {
      getCachedResult,
      cacheResult,
    });

    const first = tracked({ teamId: 'BOS' }, 'first');
    const second = tracked({ teamId: 'BOS' }, 'second');

    expect(first).toEqual({ passed: true, label: 'BOS:first' });
    expect(second).toBe(first);
    expect(validator).toHaveBeenCalledTimes(1);
    expect(cacheResult).toHaveBeenCalledTimes(1);
    expect(getCachedResult).toHaveBeenCalledTimes(2);
  });

  it('preserves validatorDebug log storage fallback behavior and clearing', () => {
    const tradeDebugSpy = vi
      .spyOn(tradeDebug, 'log')
      .mockImplementation(() => undefined);

    validatorDebug.enabled = true;
    validatorDebug.logValidation(
      'Hard Cap',
      { team: { teamName: 'Boston Celtics' } },
      { passed: false }
    );
    validatorDebug.logValidation(
      'Cash',
      { teamId: 'LAL' },
      { passed: true }
    );

    expect(validatorDebug.getLogs()).toEqual([
      expect.objectContaining({
        type: 'Hard Cap',
        teamName: 'Boston Celtics',
        result: { passed: false },
      }),
      expect.objectContaining({
        type: 'Cash',
        teamName: 'LAL',
        result: { passed: true },
      }),
    ]);
    expect(tradeDebugSpy).toHaveBeenCalledTimes(2);

    validatorDebug.clearLogs();
    expect(validatorDebug.getLogs()).toEqual([]);
  });

  it('preserves the template rule baseline result shape', () => {
    expect(validateTemplateRule()).toEqual({
      passed: true,
      violations: [],
      message: 'Rule validated',
    });
  });
});
