import { validationFlags } from '@/config/validationFlags';
import {
  EligibilityValidationResult,
  TeamContext,
  TradeTeam,
} from '../constants/types';
import { summarizeValidationIssues } from '../utils/validationIssueText';
import { collectEligibilityReacquisitionIssues } from './validateReacquisition';

interface EnforcementCallbacks {
  warn?: (message: string) => void;
  reject?: (message: string) => void;
}

export function validateEligibility(
  team: TradeTeam,
  tradeCtx: TeamContext = {}
): EligibilityValidationResult {
  const violations = collectEligibilityReacquisitionIssues(team, tradeCtx);

  return {
    passed: violations.length === 0,
    violations,
    message:
      violations.length > 0
        ? 'Player eligibility restrictions in effect'
        : 'Player eligibility validated',
    details: summarizeValidationIssues(violations),
  };
}

export function enforceEligibility(
  team: TradeTeam,
  tradeCtx: TeamContext = {},
  callbacks: EnforcementCallbacks = {}
): string[] {
  const enforcement = validationFlags.reAcquisition || validationFlags.eligibility;
  const result = validateEligibility(team, tradeCtx);
  const violations = result.violations.map((issue) => issue.message);

  violations.forEach((message) => {
    if (enforcement === 'warn') {
      (callbacks.warn || (() => {}))(message);
      return;
    }

    (callbacks.reject || (() => {}))(message);
  });

  return violations;
}
