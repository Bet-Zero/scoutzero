import {
  calculateAllowableIncoming,
  formatCurrency,
  getIncomingCeilingViaFaException,
} from '@/features/architect/utils/tradeHelpers.js';
import { validatorDebug } from '../engine/validatorDebug';
import {
  SalaryMatchingResult,
  TradeTeam,
  ValidationIssue,
} from '../constants/types';

function createIssue(
  message: string,
  code: string,
  details: string | null = null
): ValidationIssue {
  return {
    message,
    severity: 'error',
    rule: 'salaryMatching',
    code,
    details,
    meta: null,
  };
}

/**
 * Validates salary matching rules for a team in a trade.
 */
export function validateSalaryMatching(team: TradeTeam): SalaryMatchingResult {
  if (!team || typeof team !== 'object') {
    const result: SalaryMatchingResult = {
      passed: false,
      violations: [
        createIssue(
          'Invalid team data provided',
          'SALARY_MATCHING__INVALID_TEAM_DATA'
        ),
      ],
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
            createIssue(
              `FA Exception bucket insufficient (${formatCurrency(salaryIn)} > ${formatCurrency(ceiling)})`,
              'SALARY_MATCHING__FA_EXCEPTION_BUCKET_INSUFFICIENT',
              `Using ${bucketType} exception bucket`
            ),
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
          createIssue(
            `Incoming salary exceeds allowable amount by ${formatCurrency(Math.max(0, diff))}`,
            'SALARY_MATCHING__INCOMING_SALARY_EXCEEDS_ALLOWABLE_AMOUNT',
            `Outgoing: ${formatCurrency(salaryOut)} | Incoming: ${formatCurrency(salaryIn)} | Allowed: ${formatCurrency(typeof allowableResult === 'number' ? allowableResult : allowableResult.margin)}`
          ),
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
