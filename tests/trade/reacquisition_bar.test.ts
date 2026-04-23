import { describe, it, expect, afterEach } from 'vitest';
import { enforceEligibility } from '@/features/architect/utils/tradeMachine/rules/validateEligibility';
import { validateEligibility } from '@/features/architect/utils/tradeMachine/rules/validateEligibility';
import { validationFlags } from '@/config/validationFlags';
import { getValidationIssueText } from '@/features/architect/utils/tradeMachine/utils/validationIssueText';
import type {
  TradeExceptionPlayer,
  ValidationIssue,
} from '@/features/architect/utils/tradeMachine/constants/types';

const issueTexts = (issues: ValidationIssue[] = []) =>
  issues.map((issue) => getValidationIssueText(issue));

describe('re-acquisition bar', () => {
  afterEach(() => {
    validationFlags.reAcquisition = 'error';
  });

  it('validateEligibility emits canonical issue metadata for trade-back bars', () => {
    const player = {
      id: 'traded',
      name: 'Traded',
      lastTradedFromTeamId: '1',
      lastTradeDate: new Date().toISOString(),
    } satisfies TradeExceptionPlayer;
    const result = validateEligibility(
      { teamId: '1', teamName: 'Team', incomingPlayers: [player] },
      { asOfDate: new Date(Date.now() + 100 * 24 * 3600 * 1000).toISOString() }
    );

    expect(result.passed).toBe(false);
    expect(result.violations[0]).toMatchObject({
      rule: 'eligibility',
      code: 'ELIGIBILITY__REACQUISITION_TRADE_BACK_BLOCKED',
    });
    expect(issueTexts(result.violations)[0]).toMatch(/Re-acquisition bar/);
  });

  it('rejects trade-back within one year and preserves plain-string helper output', () => {
    const player = {
      name: 'Traded',
      lastTradedFromTeamId: '1',
      lastTradeDate: new Date().toISOString(),
      eligibleReacqDate: new Date(
        Date.now() + 365 * 24 * 3600 * 1000
      ).toISOString(),
    } satisfies TradeExceptionPlayer;
    const rejects: string[] = [];
    const context = {
      asOfDate: new Date(Date.now() + 100 * 24 * 3600 * 1000).toISOString(),
    };
    const violations = enforceEligibility(
      { teamId: '1', teamName: 'Team', incomingPlayers: [player] },
      context,
      { reject: (m) => rejects.push(m) }
    );

    expect(violations).toEqual(rejects);
    expect(typeof violations[0]).toBe('string');
    expect(rejects[0]).toMatch(/Re-acquisition bar/);
  });

  it('validateEligibility emits canonical issue metadata for waiver bars', () => {
    const player = {
      id: 'waived',
      name: 'Waived',
      wasWaivedByTeamId: '1',
      contractEndDate: new Date().toISOString(),
    } satisfies TradeExceptionPlayer;
    const result = validateEligibility(
      { teamId: '1', teamName: 'Team', incomingPlayers: [player] },
      { asOfDate: new Date().toISOString() }
    );

    expect(result.passed).toBe(false);
    expect(result.violations[0]).toMatchObject({
      rule: 'eligibility',
      code: 'ELIGIBILITY__REACQUISITION_WAIVER_BLOCKED',
    });
    expect(issueTexts(result.violations)[0]).toMatch(/Re-acquisition bar/);
  });

  it('rejects reacquiring waived player before July 1 after contract end', () => {
    const player = {
      name: 'Waived',
      wasWaivedByTeamId: '1',
      contractEndDate: new Date().toISOString(),
      eligibleReacqDate: new Date(
        Date.now() + 365 * 24 * 3600 * 1000
      ).toISOString(),
    } satisfies TradeExceptionPlayer;
    const rejects: string[] = [];
    const violations = enforceEligibility(
      { teamId: '1', teamName: 'Team', incomingPlayers: [player] },
      { asOfDate: new Date().toISOString() },
      { reject: (m) => rejects.push(m) }
    );

    expect(violations).toEqual(rejects);
    expect(typeof violations[0]).toBe('string');
    expect(rejects[0]).toMatch(/Re-acquisition bar/);
  });

  it('warn mode preserves the plain-string helper contract', () => {
    validationFlags.reAcquisition = 'warn';

    const player = {
      name: 'Warned',
      lastTradedFromTeamId: '1',
      lastTradeDate: new Date().toISOString(),
    } satisfies TradeExceptionPlayer;
    const warns: string[] = [];
    const rejects: string[] = [];
    const violations = enforceEligibility(
      { teamId: '1', teamName: 'Team', incomingPlayers: [player] },
      { asOfDate: new Date(Date.now() + 10 * 24 * 3600 * 1000).toISOString() },
      {
        warn: (m) => warns.push(m),
        reject: (m) => rejects.push(m),
      }
    );

    expect(rejects).toEqual([]);
    expect(violations).toEqual(warns);
    expect(typeof warns[0]).toBe('string');
    expect(warns[0]).toMatch(/Re-acquisition bar/);
  });
});
