import {
  passesRosterWindow,
  getTwoWayCount,
} from '@/utils/architect/rosterUtils.js';
import { validationFlags } from '@/config/validationFlags.js';

const MIN_ROSTER = 14;
const MAX_ROSTER = 15;
const MAX_TWO_WAY = 3;

export function enforceRosterWindow(
  teamCtx,
  tradeCtx = {},
  { warn = () => {}, reject = () => {} } = {}
) {
  const check = passesRosterWindow(teamCtx.postTradeTeam, {
    require14to15:
      !tradeCtx?.graceMode && validationFlags.rosterEnforcement !== 'off',
  });

  // Handle standard roster size violations
  if (!check.ok && check.reasons.some((r) => r.includes('Standard'))) {
    const msg = `Standard roster must be ${MIN_ROSTER}–${MAX_ROSTER} players`;
    if (validationFlags.rosterEnforcement === 'error') {
      reject(msg);
    } else if (validationFlags.rosterEnforcement === 'warn') {
      warn(msg);
    }
  }

  // Handle two-way slot violations
  if (check.twoWays > MAX_TWO_WAY) {
    const msg = `Two-way slots exceeded (${check.twoWays}/${MAX_TWO_WAY})`;
    if (validationFlags.twoWayRoster === 'error') {
      reject(msg);
    } else if (validationFlags.twoWayRoster === 'warn') {
      warn(msg);
    }
  }

  return check.reasons;
}
