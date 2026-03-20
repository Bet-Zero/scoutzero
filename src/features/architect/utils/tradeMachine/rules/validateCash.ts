import { SECOND_APRON_CASH_BLOCKED } from '@/features/architect/utils/tradeMachine/constants/secondApronMessages';
import { isSecondApronTeam } from '../utils/capUtils';
import {
  CashValidationResult,
  TradeTeam,
  ValidationIssue,
} from '../constants/types';
import {
  getFirstValidationIssueText,
  summarizeValidationIssues,
} from '../utils/validationIssueText';

const SEASONAL_CASH_LIMIT = 5_800_000;

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
      details: summarizeValidationIssues(violations),
    };
  }

  const violations: ValidationIssue[] = [];
  const cashSent = Number(team.cashSent || 0);

  if (isSecondApronTeam(team.team, tradeCtx.capSettings) && cashSent > 0) {
    violations.push(
      createIssue(
        SECOND_APRON_CASH_BLOCKED,
        'CASH__SECOND_APRON_BLOCKED',
        'Second apron teams cannot send cash in trades'
      )
    );
  }

  const totalCashOut = Number(team.team?.cashLedger?.totalOut || 0) + cashSent;
  if (totalCashOut > SEASONAL_CASH_LIMIT) {
    violations.push(
      createIssue(
        `Cash sent this season (${totalCashOut.toLocaleString()}) would exceed the seasonal limit of ${SEASONAL_CASH_LIMIT.toLocaleString()}`,
        'CASH__SEASONAL_LIMIT_EXCEEDED',
        `cashSent=${cashSent.toLocaleString()} totalOut=${totalCashOut.toLocaleString()}`
      )
    );
  }

  return {
    passed: violations.length === 0,
    violations,
    message: getFirstValidationIssueText(violations, 'Cash validated'),
    details: summarizeValidationIssues(violations),
  };
}
