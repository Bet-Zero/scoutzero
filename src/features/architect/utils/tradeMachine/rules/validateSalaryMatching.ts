import {
  calculateAllowableIncoming,
  formatCurrency,
  getIncomingCeilingViaFaException,
} from '@/features/architect/utils/tradeHelpers.js';
import { validatorDebug } from '../engine/validatorDebug';
import { TradeTeam, SalaryMatchingResult } from '../constants/types';

/**
 * Validates salary matching rules for a team in a trade.
 */
export function validateSalaryMatching(team: TradeTeam): SalaryMatchingResult {
  if (!team || typeof team !== 'object') {
    const result: SalaryMatchingResult = {
      passed: false,
      violations: ['Invalid team data provided'],
      message: 'Validation failed - no team data',
      details: '',
      salaryIn: 0,
      salaryOut: 0,
      difference: 0,
    };
    validatorDebug.logValidation('Salary Matching', team || {}, result);
    return result;
  }

  const { salaryOut, salaryIn, absorptionMode, bucketType } = team;

  // Handle FA Exception mode
  if (absorptionMode === 'FA_EXCEPTION' && bucketType) {
    const ceiling = getIncomingCeilingViaFaException(team, bucketType);
    const exceeds = salaryIn > ceiling;
    const result: SalaryMatchingResult = {
      passed: !exceeds,
      violations: exceeds
        ? [
            `FA Exception bucket insufficient (${formatCurrency(salaryIn)} > ${formatCurrency(ceiling)})`,
          ]
        : [],
      message: exceeds ? 'FA Exception violation' : 'FA Exception valid',
      details: `Using ${bucketType} exception bucket`,
      ceiling,
      salaryIn,
      salaryOut,
      difference: salaryIn - ceiling,
      allowable: ceiling,
    };
    validatorDebug.logValidation('Salary Matching', team, result);
    return result;
  }

  // Calculate allowable incoming salary
  const allowableResult = calculateAllowableIncoming(
    team.teamTotalSalary,
    team.salaryOut,
    team.incomingPlayers,
    [], // tradeExceptions
    team.capSettings,
    team.context?.yearKey
  );

  const diff =
    salaryIn -
    (typeof allowableResult === 'number'
      ? allowableResult
      : allowableResult.margin);
  const passes = diff <= 0;

  const result: SalaryMatchingResult = {
    passed: passes,
    violations: passes
      ? []
      : [
          `Incoming salary exceeds allowable amount by ${formatCurrency(Math.max(0, diff))}`,
        ],
    message: passes ? 'Valid salary match' : 'Salary mismatch',
    details: passes
      ? ''
      : `Outgoing: ${formatCurrency(salaryOut)} | ` +
        `Incoming: ${formatCurrency(salaryIn)} | ` +
        `Allowed: ${formatCurrency(typeof allowableResult === 'number' ? allowableResult : allowableResult.margin)}`,
    allowable:
      typeof allowableResult === 'number'
        ? allowableResult
        : allowableResult.margin,
    salaryIn,
    salaryOut,
    difference: diff,
  };

  validatorDebug.logValidation('Salary Matching', team, result);
  return result;
}
