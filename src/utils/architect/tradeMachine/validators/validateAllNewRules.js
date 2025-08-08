import { validateTradeExceptions } from './validateTradeExceptions.js';
import { validateDraftPicks } from './validateDraftPicks.js';
import { validateCash } from './validateCash.js';
import { validateSignAndTrade } from './validateSignAndTrade.js';
import { validateBYC } from './validateBYC.js';
import { validateSecondApronRules } from './validateSecondApronRules.js';

export function validateAllNewRules(team, allTeams, tradeCtx = {}) {
  return [
    ...validateTradeExceptions(team),
    ...validateDraftPicks(team, allTeams),
    ...validateCash(team),
    ...validateSignAndTrade(team, tradeCtx),
    ...validateBYC(team),
    ...validateSecondApronRules(team),
  ];
}
