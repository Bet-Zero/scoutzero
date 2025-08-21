import { isSecondApronTeam } from '../capHelpers.js';

export function validateCash(team, tradeCtx) {
  if (!team || !tradeCtx) {
    return {
      passed: false,
      violations: ['Invalid trade data'],
      message: 'Missing trade context',
    };
  }

  const violations = [];

  // Check if team is over second apron
  if (isSecondApronTeam(team.team, tradeCtx.capSettings)) {
    if (team.cashOut > 0) {
      violations.push('Teams over the Second Apron cannot send cash');
    }
  }

  // Check seasonal cash limit
  const seasonLimit = 5_800_000; // $5.8M for 2023-24
  const totalCashOut =
    (team.team.cashLedger?.totalOut || 0) + (team.cashOut || 0);

  if (totalCashOut > seasonLimit) {
    violations.push(
      `Cash sent this season (${totalCashOut.toLocaleString()}) would exceed the seasonal limit of ${seasonLimit.toLocaleString()}`
    );
  }

  return {
    passed: violations.length === 0,
    violations,
    message: violations.length ? violations[0] : 'Cash validated',
  };
}
