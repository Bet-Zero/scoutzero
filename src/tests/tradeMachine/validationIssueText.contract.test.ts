import { describe, expect, it } from 'vitest';
import {
  createValidationIssue,
  getFirstValidationIssueText,
  getValidationIssueText,
  isValidationIssue,
  normalizeValidationIssues,
  summarizeValidationIssues,
} from '@/features/architect/utils/tradeMachine/utils/validationIssueText.js';

describe('validationIssueText contract', () => {
  it('preserves canonical issue passthrough semantics', () => {
    const canonicalIssue = {
      message: 'Canonical issue',
      severity: 'error' as const,
      rule: 'salaryMatching',
      code: 'SALARY_MATCHING__CANONICAL_ISSUE',
      details: { source: 'rule' },
      meta: { owner: 'validator' },
    };

    expect(isValidationIssue(canonicalIssue)).toBe(true);
    expect(createValidationIssue(canonicalIssue)).toEqual(canonicalIssue);
  });

  it('normalizes raw string issues into canonical output', () => {
    expect(
      normalizeValidationIssues('  Cash sent exceeds limit  ', {
        rule: 'cash',
        severity: 'error',
      })
    ).toEqual([
      {
        message: 'Cash sent exceeds limit',
        severity: 'error',
        rule: 'cash',
        code: 'CASH__CASH_SENT_EXCEEDS_LIMIT',
        details: null,
        meta: null,
      },
    ]);
  });

  it('normalizes legacy issue objects using current message fallback order', () => {
    const fromReason = createValidationIssue(
      {
        reason: 'Reason text',
        code: 'LEGACY__REASON',
      },
      { rule: 'eligibility' }
    );
    const fromDetails = createValidationIssue(
      {
        details: 'Detail text',
        type: 'legacy_type',
      },
      { rule: 'timingEnforcement', severity: 'warning' }
    );
    const fromCode = createValidationIssue(
      {
        code: 'LEGACY__CODE_ONLY',
      },
      { rule: 'tradeValidation' }
    );
    const fromType = createValidationIssue(
      {
        type: 'legacyTypeOnly',
      },
      { rule: 'tradeValidation' }
    );

    expect(fromReason).toMatchObject({
      message: 'Reason text',
      code: 'LEGACY__REASON',
      rule: 'eligibility',
    });
    expect(fromDetails).toMatchObject({
      message: 'Detail text',
      code: 'legacy_type',
      severity: 'warning',
      rule: 'timingEnforcement',
    });
    expect(fromCode).toMatchObject({
      message: 'LEGACY__CODE_ONLY',
      code: 'LEGACY__CODE_ONLY',
      rule: 'tradeValidation',
    });
    expect(fromType).toMatchObject({
      message: 'legacyTypeOnly',
      code: 'legacyTypeOnly',
      rule: 'tradeValidation',
    });
  });

  it('preserves fallback severity rule and code generation behavior', () => {
    const issue = createValidationIssue(
      {
        message: 'Hard cap warning',
        severity: 'info',
      },
      {
        rule: 'hardCap',
        severity: 'warning',
      }
    );

    expect(issue).toMatchObject({
      message: 'Hard cap warning',
      severity: 'warning',
      rule: 'hardCap',
      code: 'HARD_CAP__HARD_CAP_WARNING',
    });
  });

  it('merges meta while excluding canonical and legacy message-selection keys', () => {
    const issue = createValidationIssue(
      {
        reason: 'Reason text',
        type: 'legacyType',
        meta: { helper: 'issue-meta' },
        extraFlag: true,
        skipped: undefined,
      },
      {
        rule: 'tradeExceptions',
        meta: { source: 'defaults' },
      }
    );

    expect(issue?.meta).toEqual({
      source: 'defaults',
      helper: 'issue-meta',
      extraFlag: true,
    });
  });

  it('filters nullish and empty raw strings while preserving current fallback stringification behavior', () => {
    const normalizedIssues = normalizeValidationIssues(
      [null, undefined, '   ', { message: '  ' }, false],
      {
        rule: 'validation',
      }
    );

    expect(normalizedIssues).toEqual([
      {
        message: '[object Object]',
        severity: 'error',
        rule: 'validation',
        code: 'VALIDATION__OBJECT_OBJECT',
        details: null,
        meta: null,
      },
      {
        message: 'false',
        severity: 'error',
        rule: 'validation',
        code: 'VALIDATION__FALSE',
        details: null,
        meta: null,
      },
    ]);
  });

  it('preserves direct issue text first-issue text and summary text helpers', () => {
    expect(getValidationIssueText({ reason: 'Legacy reason text' })).toBe(
      'Legacy reason text'
    );
    expect(
      getFirstValidationIssueText(
        ['   ', { details: 'Detail-driven text' }, 'Second issue'],
        'Fallback text'
      )
    ).toBe('Detail-driven text');
    expect(
      summarizeValidationIssues(
        ['First', { reason: 'Second' }, { details: 'Third' }],
        'Fallback text'
      )
    ).toBe('First; Second; Third');
    expect(getFirstValidationIssueText([], 'Fallback text')).toBe('Fallback text');
    expect(summarizeValidationIssues([], 'Fallback text')).toBe('Fallback text');
  });

  it('keeps string coercion helpers non-enumerable on canonical issues', () => {
    const issue = createValidationIssue('Trade validation failed', {
      rule: 'validation',
    });

    expect(issue).not.toBeNull();
    expect(String(issue)).toBe('Trade validation failed');
    expect(`${issue}`).toBe('Trade validation failed');
    expect(issue?.valueOf()).toBe('Trade validation failed');
    expect(Object.keys(issue || {})).not.toContain('toString');
    expect(Object.keys(issue || {})).not.toContain('valueOf');
  });
});
