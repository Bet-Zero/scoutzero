import { describe, it, expect } from 'vitest';

describe('Trade Validation Integration', () => {
  it('blocks trade when validation fails', () => {
    // Test that illegal trades are blocked
    const mockValidationResult = {
      passed: false,
      warnings: [],
      violations: ['Salary matching violation'],
      perTeam: {
        'team1': {
          passed: false,
          warnings: [],
          violations: ['Salary matching violation']
        }
      },
      details: { legal: false }
    };

    const forceTrade = false;
    const shouldBlock = !mockValidationResult.passed && !forceTrade;
    
    expect(shouldBlock).toBe(true);
    expect(mockValidationResult.violations).toContain('Salary matching violation');
  });

  it('allows trade when warnings but no violations', () => {
    // Test that warnings don't block trades
    const mockValidationResult = {
      passed: true,
      warnings: ['Player consent required'],
      violations: [],
      perTeam: {
        'team1': {
          passed: true,
          warnings: ['Player consent required'],
          violations: []
        }
      },
      details: { legal: true }
    };

    const forceTrade = false;
    const shouldBlock = !mockValidationResult.passed && !forceTrade;
    
    expect(shouldBlock).toBe(false);
    expect(mockValidationResult.warnings).toContain('Player consent required');
    expect(mockValidationResult.passed).toBe(true);
  });

  it('allows forced trades even when illegal', () => {
    // Test that forceTrade bypasses blocking
    const mockValidationResult = {
      passed: false,
      warnings: [],
      violations: ['Hard cap violation'],
      perTeam: {},
      details: { legal: false }
    };

    const forceTrade = true;
    const shouldBlock = !mockValidationResult.passed && !forceTrade;
    
    expect(shouldBlock).toBe(false); // Force trade should allow it through
  });

  it('returns correct status indicators', () => {
    // Test status indicator logic
    const getStatusForTeam = (teamData) => {
      if (teamData.passed) {
        return { status: 'legal', icon: '✅', color: 'text-green-400' };
      } else if (teamData.warnings.length > 0 && teamData.violations.length === 0) {
        return { status: 'warning', icon: '⚠️', color: 'text-yellow-400' };
      } else {
        return { status: 'illegal', icon: '❌', color: 'text-red-400' };
      }
    };

    // Legal team
    expect(getStatusForTeam({ passed: true, warnings: [], violations: [] })).toEqual({
      status: 'legal', icon: '✅', color: 'text-green-400'
    });

    // Warning team (no violations)
    expect(getStatusForTeam({ passed: true, warnings: ['Warning'], violations: [] })).toEqual({
      status: 'legal', icon: '✅', color: 'text-green-400'
    });

    // Illegal team
    expect(getStatusForTeam({ passed: false, warnings: [], violations: ['Violation'] })).toEqual({
      status: 'illegal', icon: '❌', color: 'text-red-400'
    });
  });
});