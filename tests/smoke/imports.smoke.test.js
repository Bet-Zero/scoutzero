/**
 * FILE: tests/smoke/imports.smoke.test.js
 *
 * Smoke tests for critical imports
 * Ensures that core modules can be imported without errors
 */

import { describe, it, expect } from 'vitest';

describe('Critical Imports Smoke Test', () => {
  it('can import React', async () => {
    const React = await import('react');
    expect(React).toBeDefined();
    expect(React.useState).toBeTypeOf('function');
  });

  it('can import Firebase config', async () => {
    const { db } = await import('@/firebaseConfig.js');
    expect(db).toBeDefined();
  });

  it('can import architect utils', async () => {
    const capUtils = await import(
      '@/features/architect/utils/tradeMachine/utils/capUtils'
    );
    expect(capUtils.toNum).toBeTypeOf('function');
    expect(capUtils.toSeasonKey).toBeTypeOf('function');
  });

  it('can import salaryMargin through the direct helper path', async () => {
    const salaryMargin = await import(
      '@/features/architect/utils/tradeMachine/utils/salaryMargin'
    );
    expect(salaryMargin.getAllowableIncomingMargin).toBeTypeOf('function');
    expect(salaryMargin.getIncomingCeilingForTeam).toBeTypeOf('function');
  });

  it('can import salaryMargin through the tradeMachine public index', async () => {
    const tradeMachine = await import('@/features/architect/utils/tradeMachine');
    expect(tradeMachine.getAllowableIncomingMargin).toBeTypeOf('function');
    expect(tradeMachine.getIncomingCeilingForTeam).toBeTypeOf('function');
  });

  it('can import validateFaExceptionUsage through the tradeMachine public index', async () => {
    const tradeMachine = await import('@/features/architect/utils/tradeMachine');
    expect(tradeMachine.validateFaExceptionUsage).toBeTypeOf('function');
  });

  it('can import the rules barrel after stale export cleanup', async () => {
    const rules = await import('@/features/architect/utils/tradeMachine/rules');
    expect(rules.validateRoster).toBeTypeOf('function');
    expect(rules.validateCash).toBeTypeOf('function');
    expect(rules.validateReacquisition).toBeTypeOf('function');
  });

  it('can import the utils barrel after stale export cleanup', async () => {
    const utils = await import('@/features/architect/utils/tradeMachine/utils');
    expect(utils.createTPE).toBeTypeOf('function');
    expect(utils.getIncomingCeilingForTeam).toBeTypeOf('function');
    expect(utils.isMeaningfulProtection).toBeTypeOf('function');
    expect(utils.normalizeTradeInput).toBeTypeOf('function');
  });

  it('can import shared utilities', async () => {
    const formatting = await import('@/shared/utils/formatting');
    expect(formatting.formatHeight).toBeTypeOf('function');
  });

  it('can import yearDefaults constants', async () => {
    const constants = await import('@/constants/yearDefaults.js');
    expect(constants.DEFAULT_SALARY_YEAR).toBeDefined();
  });
});
