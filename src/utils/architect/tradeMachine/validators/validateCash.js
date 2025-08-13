import { getSeasonalCashLimit } from '@/utils/architect/tradeHelpers.js';
import { getApronStatus } from '@/utils/architect/tradeHelpers.js';
import { validationFlags } from '@/config/validationFlags.js';

export function validateCash(team, tradeCtx = {}) {
  const violations = [];
  const {
    teamTotalSalary = 0,
    cashSent = 0,
    cashReceived = 0,
    context = {},
  } = team;
  const { capSettings = {} } = context;
  const seasonalLimit = getSeasonalCashLimit(context.yearKey);

  // Second apron teams cannot send or receive cash
  if (getApronStatus(teamTotalSalary, capSettings).includes('2nd Apron')) {
    if (cashSent > 0 || cashReceived > 0) {
      violations.push('Second apron teams cannot send or receive cash');
    }
  }

  // Check seasonal limits if flag is set
  if (validationFlags.seasonalCash === 'error') {
    const history = tradeCtx.tradesHistory || [];
    const season = tradeCtx.season || context.yearKey;

    const totalCashOut =
      history.reduce((sum, t) => {
        if (t.season === season && t.fromTeamId === team.teamId) {
          return sum + (t.cashSent || 0);
        }
        return sum;
      }, 0) + cashSent;

    if (totalCashOut > seasonalLimit) {
      violations.push('Cash sent exceeds seasonal cap');
    }
  }

  return {
    passed: violations.length === 0,
    violations,
    message:
      violations.length > 0
        ? 'Cash restrictions violated'
        : 'Cash restrictions passed',
    details: violations.join('; '),
  };
}
