import debug from './tradeDebug.js';
import { ValidationResult } from './types';

interface ValidationLog {
  validator: string;
  team: string;
  result: string;
  details: string;
  violations: string[];
  timestamp: string;
}

/**
 * Debug logger specifically for trade validators
 * Helps track validation flow and diagnose issues
 */
export const validatorDebug = {
  enabled: debug.enabled,
  logs: [] as ValidationLog[],

  logValidation(
    validator: string,
    team: { teamName?: string },
    result: ValidationResult
  ): void {
    if (!this.enabled) return;

    const teamName = team.teamName || 'Unknown Team';
    const status = result.passed ? '✅ PASS' : '❌ FAIL';
    const details = result.violations.length
      ? `\n  Violations: ${result.violations.join('\n  ')}`
      : '';

    this.logs.push({
      validator,
      team: teamName,
      result: status,
      details: result.details,
      violations: result.violations,
      timestamp: new Date().toISOString(),
    });

    debug.log(`🔍 ${validator} – ${teamName}\n` + `${status}${details}`, {
      team: teamName,
      validation: true,
    });
  },

  getValidationHistory(team: { teamName?: string }): ValidationLog[] {
    const teamName = team.teamName || 'Unknown Team';
    return this.logs.filter((log) => log.team === teamName);
  },

  clear(): void {
    this.logs = [];
  },
};
