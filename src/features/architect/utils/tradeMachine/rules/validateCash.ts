import type {
  CashValidationResult,
  TradeTeam,
  ValidationIssue,
} from '../constants/types';
import { evaluateGovernedCashConsideration } from '../utils/governedCashConsideration';
import { getFirstValidationIssueText } from '../utils/validationIssueText';

function createIssue(
  message: string,
  code: string,
  details: string | null = null
): ValidationIssue {
  return {
    message,
    severity: 'error',
    rule: 'cash',
    code,
    details,
    meta: null,
  };
}

export function validateCash(
  team?: TradeTeam | null,
  tradeCtx?: TradeTeam['context'] | null
): CashValidationResult {
  if (!team || !tradeCtx) {
    const details = evaluateGovernedCashConsideration({
      team: team || { teamId: 'UNK' },
      context: tradeCtx || {},
    });
    const violations = [
      createIssue(
        'Invalid trade data',
        'CASH__INVALID_TRADE_DATA',
        'Missing trade context'
      ),
    ];

    return {
      passed: false,
      violations,
      message: 'Missing trade context',
      details,
    };
  }

  const details = evaluateGovernedCashConsideration({
    team,
    context: tradeCtx,
  });
  const issueCode =
    details.status === 'NEEDS_INPUT'
      ? 'CASH__GOVERNED_INPUT_REQUIRED'
      : 'CASH__ANNUAL_LIMIT_EXCEEDED';
  const violations = details.violations.map((message) =>
    createIssue(
      message,
      issueCode,
      details.missingInputs.length > 0
        ? `missingInputs=${details.missingInputs.join(',')}`
        : null
    )
  );

  return {
    passed: details.passed,
    violations,
    message: getFirstValidationIssueText(violations, 'Cash validated'),
    details,
    warningsOnly: false,
  };
}
